import dotenv from 'dotenv';
dotenv.config();

import { aiProvider } from './services/ai/index';


async function run() {
  try {
    const result = await aiProvider.detectFresherFriendly(
      'Software Engineer Fresher',
      '0-1 years',
      'Looking for fresh graduates with Python skills'
    );
    console.log(result);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

run();