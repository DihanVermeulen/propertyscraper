const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'proxy-rotation.log' })
  ]
});

class ProxyRotationService {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.blockedProxies = new Set();
    this.proxyStats = new Map();
    this.rotationInterval = 5; // Change proxy every N requests
    this.requestCount = 0;
  }

  /**
   * Initialize with proxy providers
   * You can use free proxies or paid services like ProxyMesh, Bright Data, etc.
   */
  async initializeProxies() {
    try {
      // Option 1: Free proxies (less reliable)
      await this.loadFreeProxies();
      
      // Option 2: Paid proxy services (more reliable)
      // await this.loadPaidProxies();
      
      // Option 3: Use your own proxy list
      // this.loadCustomProxies();

      logger.info(`Initialized ${this.proxies.length} proxies`);
      
    } catch (error) {
      logger.error(`Error initializing proxies: ${error.message}`);
      // Fallback to no proxy
      this.proxies = [null]; // null means direct connection
    }
  }

  /**
   * Load free proxies from public APIs
   * Note: Free proxies are unreliable and may not work consistently
   */
  async loadFreeProxies() {
    try {
      // Free proxy sources (use with caution in production)
      const freeProxySources = [
        'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt'
      ];

      const proxySet = new Set();

      for (const source of freeProxySources) {
        try {
          const response = await axios.get(source, { timeout: 10000 });
          const proxyList = response.data.split('\n')
            .map(line => line.trim())
            .filter(line => line && line.includes(':'))
            .slice(0, 10); // Limit to 10 per source

          proxyList.forEach(proxy => {
            const [host, port] = proxy.split(':');
            if (host && port && !isNaN(port)) {
              proxySet.add(`http://${host}:${port}`);
            }
          });

        } catch (error) {
          logger.warn(`Failed to load proxies from ${source}: ${error.message}`);
        }
      }

      this.proxies = Array.from(proxySet);
      logger.info(`Loaded ${this.proxies.length} free proxies`);

    } catch (error) {
      logger.error(`Error loading free proxies: ${error.message}`);
      this.proxies = [];
    }
  }

  /**
   * Configure paid proxy services (recommended for production)
   */
  loadPaidProxies() {
    // Example configurations for popular proxy services
    const paidProxies = [
      // ProxyMesh (replace with your credentials)
      // 'http://username:password@us-wa.proxymesh.com:31280',
      // 'http://username:password@us-il.proxymesh.com:31280',
      
      // Bright Data (replace with your credentials)
      // 'http://username:password@zproxy.lum-superproxy.io:22225',
      
      // ScrapingBee proxy endpoint (replace with API key)
      // This would require different integration
      
      // Add your own proxy servers here
    ];

    this.proxies = paidProxies;
    logger.info(`Loaded ${paidProxies.length} paid proxies`);
  }

  /**
   * Load custom proxy list
   */
  loadCustomProxies() {
    // You can maintain your own list of proxies
    const customProxies = [
      // Add your proxy servers here
      // 'http://proxy1.yourserver.com:8080',
      // 'http://proxy2.yourserver.com:8080',
    ];

    this.proxies = customProxies;
  }

  /**
   * Get the next proxy in rotation
   */
  getNextProxy() {
    if (this.proxies.length === 0) {
      return null; // No proxy available
    }

    // Skip blocked proxies
    let attempts = 0;
    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      
      if (!this.blockedProxies.has(proxy)) {
        // Rotate to next proxy for next request
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        this.requestCount++;
        
        // Update stats
        if (!this.proxyStats.has(proxy)) {
          this.proxyStats.set(proxy, { requests: 0, failures: 0 });
        }
        this.proxyStats.get(proxy).requests++;
        
        logger.info(`Using proxy: ${proxy || 'direct connection'} (request ${this.requestCount})`);
        return proxy;
      }

      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      attempts++;
    }

    logger.warn('All proxies are blocked, falling back to direct connection');
    return null;
  }

  /**
   * Mark a proxy as blocked
   */
  markProxyAsBlocked(proxy, reason = 'unknown') {
    if (proxy) {
      this.blockedProxies.add(proxy);
      
      if (this.proxyStats.has(proxy)) {
        this.proxyStats.get(proxy).failures++;
      }
      
      logger.warn(`Marked proxy as blocked: ${proxy} (reason: ${reason})`);
    }
  }

  /**
   * Test proxy connectivity
   */
  async testProxy(proxy) {
    try {
      const testUrl = 'https://httpbin.org/ip'; // Simple service to test connectivity
      const response = await axios.get(testUrl, {
        proxy: this.parseProxy(proxy),
        timeout: 10000
      });

      return {
        working: true,
        ip: response.data.origin,
        responseTime: Date.now()
      };

    } catch (error) {
      return {
        working: false,
        error: error.message
      };
    }
  }

  /**
   * Parse proxy URL into Axios proxy config
   */
  parseProxy(proxyUrl) {
    if (!proxyUrl) return false;

    try {
      const url = new URL(proxyUrl);
      return {
        protocol: url.protocol.slice(0, -1), // Remove trailing :
        host: url.hostname,
        port: parseInt(url.port),
        auth: url.username && url.password ? {
          username: url.username,
          password: url.password
        } : undefined
      };
    } catch (error) {
      logger.error(`Error parsing proxy URL ${proxyUrl}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get proxy configuration for Playwright
   */
  getPlaywrightProxyConfig(proxyUrl) {
    if (!proxyUrl) return undefined;

    try {
      const url = new URL(proxyUrl);
      const config = {
        server: `${url.protocol}//${url.hostname}:${url.port}`
      };

      if (url.username && url.password) {
        config.username = url.username;
        config.password = url.password;
      }

      return config;
    } catch (error) {
      logger.error(`Error creating Playwright proxy config: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Reset blocked proxies (useful for recovery)
   */
  resetBlockedProxies() {
    const count = this.blockedProxies.size;
    this.blockedProxies.clear();
    logger.info(`Reset ${count} blocked proxies`);
    return count;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    const stats = {
      totalProxies: this.proxies.length,
      blockedProxies: this.blockedProxies.size,
      activeProxies: this.proxies.length - this.blockedProxies.size,
      totalRequests: this.requestCount,
      proxyDetails: {}
    };

    for (const [proxy, data] of this.proxyStats) {
      const successRate = data.requests > 0 ? ((data.requests - data.failures) / data.requests * 100).toFixed(1) : '0';
      stats.proxyDetails[proxy || 'direct'] = {
        requests: data.requests,
        failures: data.failures,
        successRate: successRate + '%',
        blocked: this.blockedProxies.has(proxy)
      };
    }

    return stats;
  }
}

module.exports = ProxyRotationService;
