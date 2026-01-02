import axios  from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'error',
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

const apiHeaders = {
  'Content-Type': 'application/json',
  apikey: process.env.API_KEY,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Axios request with exponential back-off retry
 * @param {Object} config         – full axios config (method, url, data, headers …)
 * @param {Number} maxRetries     – defaults to 3
 * @param {Number} initialDelay   – ms, defaults to 300
 * @param {Number} multiplier     – exponential factor, defaults to 2
 */

async function axiosWithRetry(config, maxRetries = 3, initialDelay = 300, multiplier = 2) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios(config);
    } catch (err) {
      lastError = err;
      const isRetryable =
        !err.response ||
        err.response.status >= 500 ||
        err.response.status === 429 ||
        [400, 409, 449].includes(err.response.status);

      const willRetry = attempt < maxRetries && isRetryable;
      logger.debug(`[axiosWithRetry] attempt ${attempt} failed (${err.message}) – willRetry:${willRetry}`);
      if (!willRetry) break;

      const delay = initialDelay * Math.pow(multiplier, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ */
/* 5.  Existing helper functions – ONLY axios line changed            */
/* ------------------------------------------------------------------ */
async function getTransactionDataByPage(page) {
  try {
    const config = {
      method: 'get',
      url: `${process.env.INVESTMENTS_API_URL}/user-transaction`,
      params: {
        page,
        transaction_status: 'success',
        holding_status: 'Pending',
        f_issuer_id: 'c791d914-ef3b-4c63-a9be-f0d3d772e89a',
      },
      headers: apiHeaders,
    };
    const response = await axiosWithRetry(config);
    return response.data;
  } catch (error) {
    if (error.isAxiosError) {
      const errorMessage = error.response?.data?.message || '';
      const statusCode = error.response?.status || '';
      const errorCode = error.code || '';
      const errorStack = JSON.stringify(error.stack) || '';
      logger.error(`Error ShriramApplicationStatus:getTransactionDataByPage:: ${errorMessage}  ${statusCode} ${errorCode} ${errorStack}`);
      throw new Error(`Error: ${errorMessage}, Status Code: ${statusCode}`);
    }
    logger.error('Error ShriramApplicationStatus:getTransactionDataByPage:', error);
    throw error;
  }
}

async function updateTransaction(body) {
  try {
    const config = {
      method: 'put',
      url: `${process.env.INVESTMENTS_API_URL}/user-transaction/${body.f_user_transaction_id}`,
      headers: apiHeaders,
      data: body,
    };
    await axiosWithRetry(config);                    // ← retry wrapper
  } catch (error) {
    if (error.isAxiosError) {
      const errorMessage = error.response?.data?.message || '';
      const statusCode = error.response?.status || '';
      const errorCode = error.code || '';
      const errorStack = JSON.stringify(error.stack) || '';
      logger.error(`Error updateTransaction: ${errorMessage}  ${statusCode} ${errorCode} ${errorStack} ${body.f_user_transaction_id}`);
      throw new Error(`Error: ${errorMessage}, Status Code: ${statusCode}`);
    }
    logger.error('Error updateTransaction ', error);
    throw error;
  }
}

async function createHolding(body) {
  try {
    const config = {
      method: 'post',
      url: `${process.env.INVESTMENTS_API_URL}/user-holdings`,
      headers: apiHeaders,
      data: body,
    };
    const response = await axiosWithRetry(config);
    return response.data;
  } catch (error) {
    if (error.isAxiosError) {
      const errorMessage = error.response?.data?.message || '';
      const statusCode = error.response?.status || '';
      const errorCode = error.code || '';
      const errorStack = JSON.stringify(error.stack) || '';
      logger.error(`Error createHolding: ${errorMessage}  ${statusCode} ${errorCode} ${errorStack}`);
      throw new Error(`Error: ${errorMessage}, Status Code: ${statusCode}`);
    }
    logger.error('Error createHolding ', error);
    throw error.response?.data?.error || error;
  }
}

async function shriramApplicationStatus(body) {
  try {
    const config = {
      method: 'post',
      url: `${process.env.SHRIRAM_API_URL}/internal/api/v1/status/cert`,
      headers: apiHeaders,
      data: body,
    };
    const response = await axiosWithRetry(config);
    console.log('response shriramApplicationStatus', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.log('Status Cert Error: ', error.response?.data, 'Payload:', body);
    if (error.isAxiosError) {
      const errorMessage = error.response?.data?.message || '';
      const statusCode = error.response?.status || '';
      const errorCode = error.code || '';
      const errorStack = JSON.stringify(error.stack) || '';
      logger.error(`Error ShriramApplicationStatus:shriramApplicationStatus: ${errorMessage}  ${statusCode} ${errorCode} ${errorStack} ${body.f_user_transaction_id}`);
      throw new Error(`Error: ${errorMessage}, Status Code: ${statusCode}`);
    }
    logger.error('Error ShriramApplicationStatus:shriramApplicationStatus: ', error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 6.  Existing orchestration & Lambda handler – untouched            */
/* ------------------------------------------------------------------ */
async function ShriramApplicationStatusJob() {
  const start = Date.now();
  const CHUNK_SIZE = 20;
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const data = await getTransactionDataByPage(page);
      const payload = data.payload || [];
      console.log(`📄 Page: ${page}, Items: ${payload.length}`);
      if (payload.length === 0) {
        hasMore = false;
        break;
      }
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        const tasks = chunk.map(async (item, indexInChunk) => {
          const globalIndex = (page - 1) * payload.length + i + indexInChunk;
          const body = {
            f_user_transaction_id: item.f_user_transaction_id,
            issuer_transaction_id: item.issuer_transaction_id,
          };
          console.log(`➡️ Request [${globalIndex}]: ${JSON.stringify(body)}`);
          try {
            const response = await shriramApplicationStatus(body);
            console.log(`✅ Response [${globalIndex}]:`, response);
            return response;
          } catch (error) {
            console.error(`❌ Error [${globalIndex}]:`, error.message || error);
            return null;
          }
        });
        await Promise.all(tasks);
      }
      page++;
    }
  } catch (error) {
    logger.error('Error ShriramApplicationStatus:ShriramApplicationStatusJob:', error);
    throw error;
  } finally {
    console.log('ShriramApplicationStatus:ShriramApplicationStatusJob :', { start, end: Date.now() });
  }
}

export const handler = async (event) => {
  try {
    await ShriramApplicationStatusJob();
    return { statusCode: 200, body: JSON.stringify({ message: 'API call completed' }) };
  } catch (error) {
    logger.error('Error during Lambda execution:', { message: error.message, stack: error.stack });
    return { statusCode: 500, body: JSON.stringify({ message: 'API call failed' }) };
  }
};