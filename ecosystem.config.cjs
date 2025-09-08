module.exports = {
  apps: [
    {
      name: 'jp-proofreading-github',
      script: 'server.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: ['server.js', 'lib/', 'data/'],
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'public', '.git'],
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};