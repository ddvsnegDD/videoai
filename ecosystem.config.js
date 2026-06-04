module.exports = {
  apps: [{
    name: 'videoai',
    script: 'server.js',
    instances: 1,          // РОВНО 1 — в приложении фоновый reconciler/watchdog;
    exec_mode: 'fork',     //    несколько экземпляров = двойные списания/возвраты fal
    env: { NODE_ENV: 'production' }
  }]
};
