import express from 'express';
import os from 'os';

const router = express.Router();

export function getNetworkAddresses(port = 5000) {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          ip: net.address,
          url: `http://${net.address}:${port}`
        });
      }
    }
  }

  return addresses;
}

router.get('/network-info', (req, res) => {
  const port = process.env.PORT || 5000;
  const addresses = getNetworkAddresses(port);
  res.json({
    localUrl: `http://localhost:${port}`,
    networkAddresses: addresses,
    primaryLanUrl: addresses.length > 0 ? addresses[0].url : `http://localhost:${port}`
  });
});

export default router;
