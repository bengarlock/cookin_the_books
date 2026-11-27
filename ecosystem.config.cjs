// Production (Jabba). The start script loads this app's settings, including
// the demo credentials, from the production 1Password Environment on every
// start, so PM2's saved process list never holds them.
module.exports = {
  apps: [
    {
      name: "cookin_the_books",
      cwd: "/home/deploy/Projects/cookin_the_books",
      script: "/home/deploy/.local/bin/cookin-the-books-op-exec",
      args: "npm start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: 6433,
      },
    },
  ],
};
