const axios = require("axios");

const MSG91_API_KEY = "418124AsbkkEdM65f1c681P1";
const MSG91_ACCESS_TOKEN = "418124TIVG9SBwpUb65f1c52aP1";

const verifyAccessToken = async () => {
  try {
    console.log("Verifying access token...");
    const response = await axios.post(
      "https://control.msg91.com/api/v5/widget/verifyAccessToken",
      {
        authkey: MSG91_API_KEY,
        "access-token": MSG91_ACCESS_TOKEN,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Access token verified:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to verify access token:", error.response ? error.response.data : error.message);
    throw new Error("Failed to verify access token");
  }
};

const sendOTP = async (mobile) => {
  try {
    console.log(`Sending OTP to ${mobile}...`);
    await verifyAccessToken(); // Ensure access token is verified before sending OTP
    const response = await axios.post(
      "https://api.msg91.com/api/v5/otp",
      {
        authkey: MSG91_API_KEY,
        mobile: mobile,
        otp: "123456", // For testing purposes, you can set a static OTP, but in production, remove this line
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("OTP sent:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to send OTP:", error.response ? error.response.data : error.message);
    throw new Error("Failed to send OTP");
  }
};

const verifyOTP = async (mobile, otp) => {
  try {
    console.log(`Verifying OTP ${otp} for mobile ${mobile}...`);
    await verifyAccessToken(); // Ensure access token is verified before verifying OTP
    const response = await axios.post(
      "https://api.msg91.com/api/v5/otp/verify",
      {
        authkey: MSG91_API_KEY,
        mobile: mobile,
        otp: otp,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("OTP verified:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to verify OTP:", error.response ? error.response.data : error.message);
    throw new Error("Failed to verify OTP");
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
};
