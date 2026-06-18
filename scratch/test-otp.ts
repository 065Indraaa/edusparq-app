import { storeOtp, verifyOtp } from "../src/lib/telegram";

async function test() {
  const userId = "64f1b2c3d4e5f6a7b8c9d0e1";
  console.log("Storing OTP for", userId);
  const otp = await storeOtp(userId);
  console.log("Stored OTP:", otp);

  console.log("Verifying OTP:", otp);
  const verifiedUserId = await verifyOtp(otp);
  console.log("Verified UserId:", verifiedUserId);
  
  if (verifiedUserId === userId) {
    console.log("SUCCESS!");
  } else {
    console.log("FAILED!");
  }
  process.exit(0);
}

test().catch(console.error);
