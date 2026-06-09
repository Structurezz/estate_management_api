const LoungeSession  = require('../models/LoungeSession');
const DEFAULT_TRACKS = require('../data/defaultTracks');

// Build seeded suggestions from default tracks (shuffled)
function buildDefaults() {
  const shuffled = [...DEFAULT_TRACKS].sort(() => Math.random() - 0.5);
  return shuffled.map(t => ({
    videoId:   t.videoId,
    title:     t.title,
    artist:    t.artist || '',
    isDefault: true,
    votes:     [],
  }));
}

exports.getSession = async (req, res) => {
  try {
    let session = await LoungeSession.findOne({ estateId: req.estateId })
      .populate('suggestions.suggestedBy', 'name');

    if (!session) {
      session = await LoungeSession.create({
        estateId:    req.estateId,
        suggestions: buildDefaults(),
      });
      await session.populate('suggestions.suggestedBy', 'name');
    } else if (!session.suggestions.some(s => s.isDefault)) {
      // Session exists but has no default tracks — append them now
      buildDefaults().forEach(d => session.suggestions.push(d));
      await session.save();
      await session.populate('suggestions.suggestedBy', 'name');
    }

    res.json({ success: true, data: session });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateMood = async (req, res) => {
  try {
    const { isAutoDJ } = req.body;
    const update = {};
    if (typeof isAutoDJ === 'boolean') update.isAutoDJ = isAutoDJ;

    const session = await LoungeSession.findOneAndUpdate(
      { estateId: req.estateId },
      { $set: update },
      { new: true, upsert: true },
    ).populate('suggestions.suggestedBy', 'name');

    res.json({ success: true, data: session });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.suggestVideo = async (req, res) => {
  try {
    const { videoId, title } = req.body;
    if (!videoId || !title)
      return res.status(400).json({ success: false, message: 'videoId and title are required' });

    let session = await LoungeSession.findOne({ estateId: req.estateId });
    if (!session) {
      session = await LoungeSession.create({ estateId: req.estateId, suggestions: buildDefaults() });
    }

    if (session.suggestions.some(s => s.videoId === videoId))
      return res.status(400).json({ success: false, message: 'Video already in queue' });

    // community suggestions go to the front (before defaults)
    session.suggestions.unshift({
      videoId,
      title,
      isDefault:   false,
      suggestedBy: req.user._id,
      votes:       [req.user._id],
    });

    await session.save();
    await session.populate('suggestions.suggestedBy', 'name');

    res.json({ success: true, data: session });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.voteVideo = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const session = await LoungeSession.findOne({ estateId: req.estateId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const sg = session.suggestions.id(suggestionId);
    if (!sg) return res.status(404).json({ success: false, message: 'Suggestion not found' });

    const uid      = req.user._id.toString();
    const hasVoted = sg.votes.some(v => v.toString() === uid);
    if (hasVoted) sg.votes = sg.votes.filter(v => v.toString() !== uid);
    else sg.votes.push(req.user._id);

    await session.save();
    await session.populate('suggestions.suggestedBy', 'name');

    res.json({ success: true, data: session, voted: !hasVoted });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.removeSuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const session = await LoungeSession.findOne({ estateId: req.estateId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const sg = session.suggestions.id(suggestionId);
    if (!sg) return res.status(404).json({ success: false, message: 'Not found' });

    const isOwn  = sg.suggestedBy?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    // Default tracks can only be removed by admin
    if (sg.isDefault && !isAdmin)
      return res.status(403).json({ success: false, message: 'Only admin can remove default tracks' });
    if (!sg.isDefault && !isOwn && !isAdmin)
      return res.status(403).json({ success: false, message: 'Not allowed' });

    sg.deleteOne();
    await session.save();

    res.json({ success: true, message: 'Removed' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Reset defaults — re-seeds the default tracks (admin only)
exports.resetDefaults = async (req, res) => {
  try {
    let session = await LoungeSession.findOne({ estateId: req.estateId });
    if (!session) {
      session = await LoungeSession.create({ estateId: req.estateId, suggestions: buildDefaults() });
    } else {
      // Remove existing defaults, keep community suggestions
      session.suggestions = session.suggestions.filter(s => !s.isDefault);
      buildDefaults().forEach(d => session.suggestions.push(d));
      await session.save();
    }
    await session.populate('suggestions.suggestedBy', 'name');
    res.json({ success: true, data: session });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
