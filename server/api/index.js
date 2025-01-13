const app = require('../index.js');

// Export a serverless-compatible handler
module.exports = (req, res) => {
  if (req.method === 'GET') {
    res.json({ status: 'Server is running' });
    return;
  }
  app(req, res);
};
