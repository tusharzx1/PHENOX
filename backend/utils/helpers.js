const { ethers } = require('ethers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const formatEther = (value) => {
  if (ethers?.utils?.formatEther) return ethers.utils.formatEther(value);
  if (ethers?.formatEther) return ethers.formatEther(value);
  return '0';
};

const toGrams = (value) => {
  try {
    const grams = Number(formatEther(value));
    return Number.isFinite(grams) ? grams : 0;
  } catch {
    return 0;
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBigIntNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  try {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'object' && typeof value.toString === 'function') {
      return Number(value.toString());
    }
    return Number(value);
  } catch {
    return fallback;
  }
};

const normalizeAddress = (value) => {
  try {
    return ethers.utils.getAddress(String(value)).toLowerCase();
  } catch {
    return '';
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parsePositiveInt = (rawValue, fallback) => {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

module.exports = {
  ZERO_ADDRESS,
  clamp,
  normalizeAddress,
  parsePositiveInt,
  sleep,
  toBigIntNumber,
  toGrams,
  toNumber,
};
