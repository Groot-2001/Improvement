import axios from 'axios';
import winston from 'winston';

const apiHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.API_KEY,
};

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});




async function getTransactionDataByPage(page) {
  try {
    const response = await axios.get(
      `${process.env.INVESTMENTS_API_URL}/user-transaction?page=${page}&transaction_status=success&holding_status=Pending&f_issuer_id=c791d914-ef3b-4c63-a9be-f0d3d772e89a`,
      { headers: apiHeaders }
    );
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

    logger.error("Error ShriramApplicationStatus:getTransactionDataByPage:", error);
    throw error;
  }
}

async function updateTransaction(body) {
  try {
    const data = body;
    const config = {
      method: "put",
      url: `${process.env.INVESTMENTS_API_URL}/user-transaction/${body.f_user_transaction_id}`,
      headers: apiHeaders,
      data: data,
    };

    const response = await axios(config);
  } catch (error) {
    if (error.isAxiosError) {
      const errorMessage = error.response?.data?.message || '';
      const statusCode = error.response?.status || '';
      const errorCode = error.code || '';
      const errorStack = JSON.stringify(error.stack) || '';

      logger.error(`Error updateTransaction: ${errorMessage}  ${statusCode} ${errorCode} ${errorStack} ${body.f_user_transaction_id}`);
      throw new Error(`Error: ${errorMessage}, Status Code: ${statusCode}`);
    }
    logger.error("Error updateTransaction ", error);
    throw error;
  }
}

async function createHolding(body) {
  try {
    const data = body;
    const config = {
      method: "post",
      url: `${process.env.INVESTMENTS_API_URL}/user-holdings`,
      headers: apiHeaders,
      data: data,
    };

    const response = await axios(config);
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
    logger.error("Error createHolding ", error);
    throw error["response"]["data"]["error"];
  }
}

async function shriramApplicationStatus(body) {
  try {
    const response = await axios.post(
      `${process.env.SHRIRAM_API_URL}/internal/api/v1/status/cert`,
      body,
      {
        headers: apiHeaders,
      }
    );
    console.log("response shriramApplicationStatus", JSON.stringify(response.data))
    return response.data;

  } catch (error) {
    console.log("Status Cert Error: ",error.response.data,"Payload:",body);
    if (error.isAxiosError) {
      const errorMessage = error.response?.data?.message || '';
      const statusCode = error.response?.status || '';
      const errorCode = error.code || '';
      const errorStack = JSON.stringify(error.stack) || '';

      logger.error(`Error ShriramApplicationStatus:shriramApplicationStatus: ${errorMessage}  ${statusCode} ${errorCode} ${errorStack} ${body.f_user_transaction_id}`);
      throw new Error(`Error: ${errorMessage}, Status Code: ${statusCode}`);
    }
    logger.error("Error ShriramApplicationStatus:shriramApplicationStatus: ", error);
    throw error;
  }
}

// async function ShriramApplicationStatusJob() {
//   const start = Date.now();
//   try {
//     const data = await getTransactionDataByPage();
//     console.log("data count:", data.payload.length);
//     const CHUNK_SIZE = 20;
//     for (let i = 0; i < data.payload.length; i += CHUNK_SIZE) {
//       const chunk = data.payload.slice(i, i + CHUNK_SIZE);

//       const tasks = chunk.map(async (item, indexInChunk) => {
//         const globalIndex = i + indexInChunk;
//         const body = {
//           f_user_transaction_id: item.f_user_transaction_id,
//           issuer_transaction_id: item.issuer_transaction_id,
//         };

//         console.log(`➡️ Request [${globalIndex}]: ${JSON.stringify(body)}`);

//         try {
//           const response = await shriramApplicationStatus(body);
//           console.log(`✅ Response [${globalIndex}]:`, response);
//           return response;
//         } catch (error) {
//           console.error(`❌ Error [${globalIndex}]:`, error.message || error);
//           return null;
//         }
//       });

//       await Promise.all(tasks);
//     }
//   } catch (error) {
//     logger.error("Error ShriramApplicationStatus:ShriramApplicationStatusJob:", error);
//     throw error;
//   } finally {
//     console.log("ShriramApplicationStatus:ShriramApplicationStatusJob :", { start, end: Date.now() });
//   }
// }

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

      page++; // move to next page
    }
  } catch (error) {
    logger.error("Error ShriramApplicationStatus:ShriramApplicationStatusJob:", error);
    throw error;
  } finally {
    console.log("ShriramApplicationStatus:ShriramApplicationStatusJob :", { start, end: Date.now() });
  }
}

export const handler = async (event) => {
  try {
    const response = await ShriramApplicationStatusJob();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'API call completed', response: response })
    };

  } catch (error) {
    logger.error('Error during Lambda execution:', { message: error.message, stack: error.stack });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'API call failed' })
    };
  }
};
