require("dotenv").config();

module.exports = {
  datasource: {
    // Use the direct connection URL for migrations and CLI operations
    url: process.env.DIRECT_URL,
  },
};
