module.exports = {
  apps: [
    {
      name: "cookin_the_books",
      cwd: "/home/deploy/Projects/cookin_the_books",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 6433,
      },
    },
  ],
};
