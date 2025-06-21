// Start Hyperbeam session
const startSession = async () => {
  setError("");
  setLoading(true);
  try {
    const res = await fetch("/api/hyperbeam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        "x-api-secret": process.env.NEXT_PUBLIC_API_SECRET, // Use environment variable
      },
    });
    const data = await res.json();
    if (res.ok && data.url) {
      setHbUrl(data.url);
      setSessionActive(true);
    } else {
      setError(data.error || "Failed to start session");
    }
  } catch (err) {
    setError("Network error: " + err.message);
  }
  setLoading(false);
};

// End Hyperbeam session
const endSession = async () => {
  setError("");
  setEnding(true);
  try {
    const res = await fetch("/api/hyperbeam?type=end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        "x-api-secret": process.env.NEXT_PUBLIC_API_SECRET, // Use environment variable
      },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setSessionActive(false);
      setHbUrl("");
    } else {
      setError(data.error || "Failed to end session");
    }
  } catch (err) {
    setError("Network error: " + err.message);
  }
  setEnding(false);
};