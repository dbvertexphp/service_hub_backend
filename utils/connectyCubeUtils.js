const ConnectyCube = require("connectycube");
const dotenv = require("dotenv");
const ErrorHandler = require("../utils/errorHandler.js");

dotenv.config();

const CREDENTIALS = {
  appId: process.env.CAPPID,
  authKey: process.env.AUTHKEY,
  authSecret: process.env.AUTHSECRET,
};

if (!CREDENTIALS.appId || !CREDENTIALS.authKey || !CREDENTIALS.authSecret) {
  throw new Error("ConnectyCube credentials are not set correctly");
}

ConnectyCube.init(CREDENTIALS);

async function createConnectyCubeUser(mobile, password, email, full_name, role) {
  try {
    const session = await ConnectyCube.createSession();

    const userProfile = {
      login: mobile,
      password: mobile,
      email,
      full_name,
      phone: mobile,
      tag_list: [role],
      token: session.token,
    };
    const user = await ConnectyCube.users.signup(userProfile);
    return {
      token: session.token,
      id: user.user.id,
    };
  } catch (error) {
    if (error.info && error.info.errors && error.info.errors.base && error.info.errors.base.includes("email must be unique")) {
      throw new ErrorHandler("Email already exists", 400);
    } else {
      throw new ErrorHandler("ConnectyCube user creation failed", 500);
    }
  }
}
module.exports = {
  createConnectyCubeUser,
};
