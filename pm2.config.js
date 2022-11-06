module.exports = {
  apps: [{
    name: 'discord-selfbot',
    script: 'index.js',
    log: 'discord-selfbot.log',
    merge_logs: true,
    instances: 1,
    exec_mode: "cluster",
    cron_restart: '0 */6 * * *',
  }]
};
