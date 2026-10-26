/**
 * ZKTeco High-Performance Biometric Service
 * 
 * Features:
 * - High-speed backwards-chunking TCP engine (fetches recent records in < 2 seconds)
 * - Decodes standard 40-byte ZKTeco record structures
 * - Date range and employee code filtering
 * - Reliable connection test with machine capacity and user statistics
 */

import net from 'net';
import dgram from 'dgram';

const COMMANDS = {
  CMD_CONNECT: 1000,
  CMD_EXIT: 1001,
  CMD_ENABLEDEVICE: 1002,
  CMD_DISABLEDEVICE: 1003,
  CMD_GET_FREE_SIZES: 50,
  CMD_PREPARE_DATA: 1500,
  CMD_DATA: 1501,
  CMD_FREE_DATA: 1502,
  CMD_DATA_WRRQ: 1503,
  CMD_DATA_RDY: 1504,
  CMD_ACK_OK: 2000,
  CMD_ACK_ERROR: 2001,
  CMD_ACK_UNAUTH: 2005,
};

const MAX_CHUNK = 65472;
const USHRT_MAX = 65535;
const GET_ATTENDANCE_LOGS = Buffer.from([0x01, 0x0d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

// ─── Header & Checksum Utilities ─────────────────────────────────────────────

function createChkSum(buf) {
  let chksum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === buf.length - 1) chksum += buf[i];
    else chksum += buf.readUInt16LE(i);
    chksum %= USHRT_MAX;
  }
  return USHRT_MAX - chksum - 1;
}

function createTCPHeader(command, sessionId, replyId, data = Buffer.alloc(0)) {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const buf = Buffer.alloc(8 + dataBuffer.length);

  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2);
  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  dataBuffer.copy(buf, 8);

  const chksum = createChkSum(buf);
  buf.writeUInt16LE(chksum, 2);

  const replyIdNext = (replyId + 1) % USHRT_MAX;
  buf.writeUInt16LE(replyIdNext, 6);

  const prefix = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x13, 0x00, 0x00, 0x00]);
  prefix.writeUInt16LE(buf.length, 4);
  return Buffer.concat([prefix, buf]);
}

function decodeTCPHeader(header) {
  const recvData = header.subarray(8);
  const payloadSize = header.readUIntLE(4, 2);
  const commandId = recvData.readUIntLE(0, 2);
  const checkSum = recvData.readUIntLE(2, 2);
  const sessionId = recvData.readUIntLE(4, 2);
  const replyId = recvData.readUIntLE(6, 2);
  return { commandId, checkSum, sessionId, replyId, payloadSize };
}

function parseTimeToDate(time) {
  const second = time % 60;
  time = (time - second) / 60;
  const minute = time % 60;
  time = (time - minute) / 60;
  const hour = time % 24;
  time = (time - hour) / 24;
  const day = (time % 31) + 1;
  time = (time - (day - 1)) / 31;
  const month = time % 12;
  time = (time - month) / 12;
  const year = time + 2000;
  return new Date(year, month, day, hour, minute, second);
}

function decodeRecord40(buf) {
  if (!buf || buf.length < 32) return null;
  const userSn = buf.readUInt16LE(0);
  const deviceUserId = buf.slice(2, 11).toString('ascii').replace(/\0/g, '').trim();
  const timeInt = buf.readUInt32LE(27);
  const recordTime = parseTimeToDate(timeInt);
  const punch = buf.length > 31 ? buf.readUInt8(31) : 0;
  const status = buf.length > 32 ? buf.readUInt8(32) : 0;
  return { userSn, deviceUserId, recordTime, punch, status };
}

// ─── High-Level TCP Machine Client ───────────────────────────────────────────

class ZKTcpClient {
  constructor(ip, port = 4370, timeout = 15000) {
    this.ip = ip.trim();
    this.port = Number(port) || 4370;
    this.timeout = timeout;
    this.socket = null;
    this.sessionId = 0;
    this.replyId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const sock = new net.Socket();
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`انتهت مهلة الاتصال بالماكينة (${this.ip}:${this.port}) عبر TCP`));
      }, this.timeout);

      sock.connect(this.port, this.ip, async () => {
        clearTimeout(timer);
        this.socket = sock;
        try {
          // Handshake
          await this.writeCmd(COMMANDS.CMD_CONNECT);
          const reply = await this.readNextFrame(8000);
          const hdr = decodeTCPHeader(reply.subarray(0, 16));
          this.sessionId = hdr.sessionId;
          resolve();
        } catch (e) {
          this.destroy();
          reject(e);
        }
      });

      sock.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  writeCmd(cmd, data = Buffer.alloc(0)) {
    const buf = createTCPHeader(cmd, this.sessionId, this.replyId, data);
    this.replyId = (this.replyId + 1) % USHRT_MAX;
    return new Promise((resolve, reject) => {
      this.socket.write(buf, (err) => err ? reject(err) : resolve());
    });
  }

  readNextFrame(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.removeListener('data', onData);
        reject(new Error('TIMEOUT_READ_FRAME'));
      }, timeoutMs);

      let buf = Buffer.alloc(0);
      const onData = (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        if (buf.length >= 8) {
          const payloadSize = buf.readUIntLE(4, 2);
          if (buf.length >= 8 + payloadSize) {
            clearTimeout(timer);
            this.socket?.removeListener('data', onData);
            resolve(buf);
          }
        }
      };
      this.socket.on('data', onData);
    });
  }

  readChunkData(expectedSize, timeoutMs = 12000) {
    return new Promise((resolve) => {
      let accumulated = Buffer.alloc(0);
      const timer = setTimeout(() => {
        this.socket?.removeListener('data', onChunk);
        resolve(accumulated);
      }, timeoutMs);

      const onChunk = (chunk) => {
        accumulated = Buffer.concat([accumulated, chunk]);
        if (accumulated.length >= expectedSize) {
          clearTimeout(timer);
          this.socket?.removeListener('data', onChunk);
          resolve(accumulated);
        }
      };
      this.socket.on('data', onChunk);
    });
  }

  async getInfo() {
    await this.writeCmd(COMMANDS.CMD_GET_FREE_SIZES);
    const reply = await this.readNextFrame(5000);
    const data = reply.subarray(16);
    return {
      userCounts: data.readUIntLE(24, 4),
      logCounts: data.readUIntLE(40, 4),
      logCapacity: data.readUIntLE(72, 4),
    };
  }

  destroy() {
    if (this.socket) {
      try {
        this.writeCmd(COMMANDS.CMD_EXIT).catch(() => {});
        this.socket.destroy();
      } catch (e) {}
      this.socket = null;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Test connectivity with ZKTeco Biometric Machine
 */
export async function testDeviceConnection(ip, port = 4370, timeout = 7000) {
  const cleanIp = String(ip).trim();
  const isPrivate = cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp) || cleanIp === '127.0.0.1' || cleanIp === 'localhost';

  // If running on a cloud serverless environment (like Vercel), private LAN IPs cannot be reached from the public cloud
  if (process.env.VERCEL && isPrivate) {
    return {
      success: false,
      isPrivateNetwork: true,
      message: `تنبيه: أنت تفحص الاتصال من السيرفر السحابي (Vercel)، بينما عنوان الماكينة (${cleanIp}) هو عنوان شبكة داخلية (LAN) خاصة براوتر الشركة.\n\nالسيرفر السحابي على الإنترنت لا يستطيع الوصول للشبكة الداخلية للشركة مباشرة بدون Port Forwarding.\n\n💡 الحلول المتاحة:\n1. اضغط دبل كليك على أداة "سحب_البصمة_والمزامنة_السحابية.bat" على كمبيوتر الشركة لسحب البصمات ورفعها للموقع السحابي في ثانيتين.\n2. أو افتح الموقع محلياً من كمبيوتر الشركة عبر: http://localhost:5000 وسيعمل الفحص والسحب مباشرة.`,
      error: 'CLOUD_TO_LAN_NOT_ROUTABLE'
    };
  }

  const client = new ZKTcpClient(cleanIp, port, timeout);
  try {
    await client.connect();
    let info = null;
    try {
      info = await client.getInfo();
    } catch (e) {
      info = { logCounts: 0, userCounts: 0 };
    }
    client.destroy();

    return {
      success: true,
      protocol: 'tcp',
      message: `تم الاتصال بنجاح بالماكينة على العنوان ${cleanIp}:${port}`,
      info: {
        logCounts: info.logCounts,
        userCounts: info.userCounts,
        logCapacity: info.logCapacity,
        description: `الماكينة متصلة وتحتوي على ${info.logCounts.toLocaleString()} حركة بصمة و${info.userCounts} موظف مسجل`,
      },
    };
  } catch (err) {
    client.destroy();
    let msg = `فشل الاتصال بالماكينة (${cleanIp}:${port}): ${err.message}`;
    if (isPrivate) {
      msg += `\n(ملاحظة: إذا كنت تفتح الموقع من خارج الشركة أو عبر السحاب، فإن عنوان IP داخلي (LAN) لا يمكن الوصول إليه إلا من داخل شبكة الشركة أو عبر أداة سحب البصمة السحابية)`;
    }
    return {
      success: false,
      message: msg,
      error: err.message,
    };
  }
}

/**
 * Fetch attendance logs from device using fast backwards TCP scanning
 */
export async function fetchDeviceAttendances(ip, port = 4370, timeout = 30000, protocol = 'tcp', filters = {}) {
  const cleanIp = ip.trim();
  const cleanPort = Number(port) || 4370;

  const isPrivate = cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp) || cleanIp === '127.0.0.1' || cleanIp === 'localhost';
  if (process.env.VERCEL && isPrivate) {
    throw new Error(`تعذر السحب من الماكينة (${cleanIp}): هذا السيرفر سحابي (Vercel) ولا يمكنه الوصول إلى الماكينة الداخلية الخاصة براوتر الشركة مباشرة.\n\nيرجى تشغيل أداة "سحب_البصمة_والمزامنة_السحابية.bat" على جهاز الشركة لسحب الحركات ورفعها للسحاب فوراً.`);
  }
  const client = new ZKTcpClient(cleanIp, cleanPort, Math.max(Number(timeout) || 30000, 20000));

  try {
    console.log(`[ZKTeco] Connecting to ${cleanIp}:${cleanPort}...`);
    await client.connect();

    // 1. Get info
    let info = { logCounts: 0, userCounts: 0 };
    try {
      info = await client.getInfo();
      console.log(`[ZKTeco] Device info: ${info.logCounts} logs, ${info.userCounts} users`);
    } catch (e) {}

    // 2. Free any leftover buffers
    await client.writeCmd(COMMANDS.CMD_FREE_DATA);
    await client.readNextFrame(2000).catch(() => {});

    // 3. Request attendance logs
    await client.writeCmd(COMMANDS.CMD_DATA_WRRQ, GET_ATTENDANCE_LOGS);
    const prepReply = await client.readNextFrame(15000);
    const totalSize = prepReply.subarray(16).readUIntLE(1, 4);

    const remain = totalSize % MAX_CHUNK;
    const numChunks = Math.floor((totalSize - remain) / MAX_CHUNK);
    const totalChunkCount = numChunks + (remain > 0 ? 1 : 0);

    console.log(`[ZKTeco] Attendance buffer: ${totalSize} bytes (${totalChunkCount} chunks, ~${Math.round(totalSize/40)} records)`);

    // Target filters
    const targetCode = filters.employeeCode && filters.employeeCode !== 'all'
      ? String(filters.employeeCode).trim()
      : null;
    const targetCodeNum = targetCode ? parseInt(targetCode, 10) : null;
    const ignoreDateRange = !!filters.ignoreDateRange;
    const startDate = filters.startDate || null;
    const endDate = filters.endDate || null;

    // Determine how many chunks to read backwards
    // If date range is specified, stop once we go before startDate.
    // If no date range and not ignoring, read up to 6 recent chunks (~9,800 records, ~6 months).
    // If ignoreDateRange is true or user asked for full, read up to 15 chunks.
    const maxChunks = ignoreDateRange ? 15 : 8;

    const allRecords = [];
    let reachedBeforeStart = false;

    // Scan backwards from newest chunk to older chunks
    for (let c = totalChunkCount - 1; c >= 0 && (totalChunkCount - 1 - c) < maxChunks; c--) {
      const offset = c * MAX_CHUNK;
      const size = (c === numChunks && remain > 0) ? remain : MAX_CHUNK;

      const reqData = Buffer.alloc(8);
      reqData.writeUInt32LE(offset, 0);
      reqData.writeUInt32LE(size, 4);

      const chunkPromise = client.readChunkData(size, 8000);
      await client.writeCmd(COMMANDS.CMD_DATA_RDY, reqData);
      const rawChunk = await chunkPromise;

      // Decode 40-byte records inside chunk
      for (let i = 0; i <= rawChunk.length - 40; i++) {
        try {
          const rec = decodeRecord40(rawChunk.subarray(i, i + 40));
          const yr = rec.recordTime ? rec.recordTime.getFullYear() : 0;
          if (yr >= 2024 && yr <= 2028 && rec.deviceUserId && /^\d+$/.test(rec.deviceUserId)) {
            allRecords.push(rec);

            // Check date boundary
            if (startDate && !ignoreDateRange) {
              const recDateStr = rec.recordTime.toISOString().split('T')[0];
              if (recDateStr < startDate) {
                reachedBeforeStart = true;
              }
            }
          }
        } catch (e) {}
      }

      if (reachedBeforeStart) {
        console.log(`[ZKTeco] Reached records older than ${startDate}. Stopping scan.`);
        break;
      }
    }

    client.destroy();

    // Deduplicate records by user + exact timestamp
    const seen = new Set();
    const deduped = [];
    for (const r of allRecords) {
      const key = `${r.deviceUserId}_${r.recordTime.getTime()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(r);
      }
    }

    // Sort chronologically
    deduped.sort((a, b) => a.recordTime.getTime() - b.recordTime.getTime());

    // Apply filtering
    const parsed = [];
    for (const r of deduped) {
      const rawUser = String(r.deviceUserId).trim();
      const rawUserNum = parseInt(rawUser, 10);

      // Filter by employee code
      if (targetCode !== null) {
        const matchStr = rawUser === targetCode;
        const matchNum = !isNaN(rawUserNum) && !isNaN(targetCodeNum) && rawUserNum === targetCodeNum;
        if (!matchStr && !matchNum) continue;
      }

      // Format date and time
      const yr = r.recordTime.getFullYear();
      const mo = String(r.recordTime.getMonth() + 1).padStart(2, '0');
      const da = String(r.recordTime.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${da}`;

      if (!ignoreDateRange) {
        if (startDate && dateStr < startDate) continue;
        if (endDate && dateStr > endDate) continue;
      }

      const hh = String(r.recordTime.getHours()).padStart(2, '0');
      const mm = String(r.recordTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;

      parsed.push({
        employee_code: rawUser,
        device_user_id: rawUser,
        timestamp: r.recordTime.toISOString(),
        date: dateStr,
        time: timeStr,
        punch: r.punch,
        status: r.status,
      });
    }

    console.log(`[ZKTeco] Returning ${parsed.length} filtered records out of ${deduped.length} total fetched`);

    let userFriendlyMessage = null;
    if (parsed.length === 0) {
      const sampleUsers = [...new Set(deduped.map(r => r.deviceUserId))]
        .sort((a, b) => parseInt(a) - parseInt(b))
        .slice(0, 15);

      if (targetCode) {
        userFriendlyMessage = `تم الاتصال بالماكينة بنجاح وتم فحص ${deduped.length.toLocaleString()} حركة، ولكن لا توجد بصمات للموظف (كود ${targetCode})${!ignoreDateRange && (startDate || endDate) ? ` في الفترة (${startDate || ''} إلى ${endDate || ''})` : ''}.\n\nأمثلة لأكواد الموظفين المسجلين في هذه الماكينة: [${sampleUsers.join(', ')}]`;
      } else {
        userFriendlyMessage = `تم الاتصال بالماكينة بنجاح ولكن لا توجد حركات مسجلة ضمن الفترة المحددة (${startDate || ''} إلى ${endDate || ''})`;
      }
    }

    return {
      success: true,
      protocolUsed: 'tcp',
      totalDeviceLogs: info.logCounts || deduped.length,
      filteredLogsCount: parsed.length,
      logs: parsed,
      message: userFriendlyMessage,
    };

  } catch (err) {
    client.destroy();
    console.error('[ZKTeco] Fetch error:', err.message);
    throw new Error(`تعذر سحب البيانات من الماكينة ${cleanIp}:${cleanPort}: ${err.message}`);
  }
}
