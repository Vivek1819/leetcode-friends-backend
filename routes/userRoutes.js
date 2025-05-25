const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/:username", async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.status(200).json({ message: "User exists" });
});

router.post("/register", async (req, res) => {
  const { username } = req.body;
  try {
    const user = new User({ username });
    await user.save();
    console.log('User registered successfully:', username);
    res.status(201).json(user);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ message: "Error creating user", error });
  }
});

router.get("/:username/solved/:slug", async (req, res) => {
  const { username, slug } = req.params;
  try {
    const user = await User.findOne({ username }).populate("friends");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const friendsSolved = user.friends.filter((friend) =>
      friend.solvedProblems.some(
        (solvedProblem) => solvedProblem.problem === slug
      )
    );
    res.json(friendsSolved.map((friend) => friend.username));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:username/add-friend", async (req, res) => {
  try {
    // Log incoming data
    console.log('=== ADD FRIEND ENDPOINT ===');
    console.log('Username:', req.params.username);
    console.log('Friend username from request:', req.body.friendUsername);
    
    const { friendUsername } = req.body;
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const friend = await User.findOne({ username: friendUsername });
    console.log('Friend found:', friend ? 'Yes' : 'No');

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friend._id);
    await user.save();
    console.log('Friend added successfully');

    res.json({ message: `You are now friends with ${friendUsername}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:username/friends", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).populate(
      "friends",
      "username solvedProblems"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ friends: user.friends });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/:username/submissions", async (req, res) => {
  try {
    const { username } = req.params;
    const { submissions } = req.body;

    // Log incoming data for debugging
    console.log("=== SUBMISSIONS ENDPOINT ===");
    console.log("Username:", username);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Submissions count:", submissions?.length || 0);

    // Find user or create if doesn't exist
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username, solvedProblems: [] });
    }

    // Process all submissions, not just accepted ones
    // We'll use all submissions but prioritize accepted ones when there are duplicates
    
    // First, group submissions by problem slug
    const submissionsByProblem = submissions.reduce((acc, sub) => {
      if (!acc[sub.problemSlug]) {
        acc[sub.problemSlug] = [];
      }
      acc[sub.problemSlug].push(sub);
      return acc;
    }, {});
    
    // For each problem, prioritize accepted submissions
    const processedSubmissions = Object.values(submissionsByProblem).map(subs => {
      // Find an accepted submission if it exists
      const accepted = subs.find(s => s.status === "Accepted");
      return accepted || subs[0]; // Return accepted or the first submission
    });
    
    // Track the accepted submissions separately for logging
    const acceptedSubmissions = processedSubmissions.filter(
      (sub) => sub.status === "Accepted"
    );

    // Log submissions
    console.log("Total processed submissions:", processedSubmissions.length);
    console.log("Accepted submissions:", acceptedSubmissions.length);
    console.log(
      "First submission (sample):",
      processedSubmissions.length > 0
        ? JSON.stringify(processedSubmissions[0], null, 2)
        : "None"
    );

    // Create a map of current problems for easy lookup
    const currentProblemsMap = {};
    user.solvedProblems.forEach((sp) => {
      currentProblemsMap[sp.problem] = {
        submissionId: sp.submissionId,
        status: sp.status || "Accepted" // Handle existing records that might not have status
      };
    });

    // Process each submission - either add new problems or update existing ones
    const newSolvedProblems = [];
    
    processedSubmissions.forEach((sub) => {
      const problemSlug = sub.problemSlug;
      const newProblem = {
        problem: problemSlug,
        submissionId: sub.submissionId || sub.id || null,
        status: sub.status
      };
      
      if (currentProblemsMap[problemSlug]) {
        // Problem exists - update if this is an accepted submission and current is not
        const currentStatus = currentProblemsMap[problemSlug].status;
        if (sub.status === "Accepted" && currentStatus !== "Accepted") {
          // We'll update this problem's status
          const index = user.solvedProblems.findIndex(p => p.problem === problemSlug);
          if (index !== -1) {
            user.solvedProblems[index].status = "Accepted";
            user.solvedProblems[index].submissionId = newProblem.submissionId;
          }
        }
      } else {
        // New problem - add it
        newSolvedProblems.push(newProblem);
      }
    });

    // Log new problems being added
    console.log("New problems to be added:", newSolvedProblems.length);
    if (newSolvedProblems.length > 0) {
      console.log("Sample new problem:", JSON.stringify(newSolvedProblems[0], null, 2));
      user.solvedProblems = [...user.solvedProblems, ...newSolvedProblems];
      await user.save();
    } else if (user.isModified()) {
      // Save if we've made updates to existing problems
      await user.save();
    }

    res.status(200).json({
      message: "Submissions processed successfully",
      newSolvedCount: newSolvedProblems.length,
      totalSolvedCount: user.solvedProblems.length,
    });
  } catch (error) {
    console.error("Error processing submissions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
