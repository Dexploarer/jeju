// Safe IP package implementation with SSRF protections
// This replaces the vulnerable ip package

const net = require('net')

function isV4Format(ip) {
  return net.isIPv4(ip)
}

function isV6Format(ip) {
  return net.isIPv6(ip)
}

function isPrivate(ip) {
  if (!ip) return false
  
  // IPv4 private ranges
  if (isV4Format(ip)) {
    const parts = ip.split('.').map(Number)
    // 10.0.0.0/8
    if (parts[0] === 10) return true
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true
    // 0.0.0.0/8
    if (parts[0] === 0) return true
  }
  
  // IPv6 private/local
  if (isV6Format(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fe80:')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  }
  
  return false
}

function isPublic(ip) {
  return !isPrivate(ip)
}

function isLoopback(ip) {
  if (isV4Format(ip)) {
    return ip.startsWith('127.')
  }
  if (isV6Format(ip)) {
    return ip.toLowerCase() === '::1'
  }
  return false
}

function toLong(ip) {
  if (!isV4Format(ip)) return 0
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function fromLong(num) {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff
  ].join('.')
}

function address(name, family) {
  const interfaces = require('os').networkInterfaces()
  const all = Object.values(interfaces).flat().filter(Boolean)
  
  family = family || 'ipv4'
  const familyNum = family.toLowerCase() === 'ipv6' ? 6 : 4
  
  for (const addr of all) {
    if (addr.family === `IPv${familyNum}` && !addr.internal) {
      return addr.address
    }
  }
  
  return familyNum === 4 ? '127.0.0.1' : '::1'
}

module.exports = {
  isV4Format,
  isV6Format,
  isPrivate,
  isPublic,
  isLoopback,
  toLong,
  fromLong,
  address
}
