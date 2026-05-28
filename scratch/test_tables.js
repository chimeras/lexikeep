const url = "https://aoyagoggyfjhqiqyegdv.supabase.co/rest/v1/notifications";
const signUpUrl = "https://aoyagoggyfjhqiqyegdv.supabase.co/auth/v1/signup";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveWFnb2dneWZqaHFpcXllZ2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4ODQ3OTEsImV4cCI6MjA3ODQ2MDc5MX0.zN0_hlnmHcERRGEHqvAcQBx4J4qQCr9GQhnTY305mtg";

async function run() {
  try {
    console.log("Signing up a test user...");
    const email = `test_notif_${Date.now()}@gmail.com`;
    const signupRes = await fetch(signUpUrl, {
      method: "POST",
      headers: {
        "apikey": key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: "Password123!",
        data: { username: `user_${Date.now()}`, role: "student" }
      })
    });
    
    console.log("Signup status:", signupRes.status);
    const signupBody = await signupRes.json();
    if (!signupRes.ok) {
      console.error("Signup failed:", signupBody);
      return;
    }
    
    const userId = signupBody.id || signupBody.user?.id;
    const jwtToken = signupBody.access_token;
    console.log("User created successfully with ID:", userId);

    console.log("Inserting notification...");
    const notifRes = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        recipient_id: userId,
        sender_id: null,
        type: "badge",
        title: "Test Badge Unlocked",
        body: "Congratulations on test notification!",
        link: "/profile"
      })
    });

    console.log("Insert status:", notifRes.status);
    const notifBody = await notifRes.text();
    console.log("Insert response body:", notifBody);

  } catch (err) {
    console.error("Test error:", err);
  }
}

run();
