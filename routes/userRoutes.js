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
    const { submissions, latestSubmissionId } = req.body; 

    console.log("=== SUBMISSIONS ENDPOINT ===");
    console.log("Username:", username);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Submissions count:", submissions?.length || 0);
    console.log("Latest Submission ID:", latestSubmissionId || "None"); 

    // Find user or create if doesn't exist
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username, solvedProblems: [] });
    }

    if (latestSubmissionId) {
      user.lastScrapedSubmissionId = latestSubmissionId;
      console.log(`Updated checkpoint for ${username} to ${latestSubmissionId}`);
    }

    const submissionsByProblem = submissions.reduce((acc, sub) => {
      if (!acc[sub.problemSlug]) {
        acc[sub.problemSlug] = [];
      }
      acc[sub.problemSlug].push(sub);
      return acc;
    }, {});
  
    const processedSubmissions = Object.values(submissionsByProblem).map(subs => {
      const accepted = subs.find(s => s.status === "Accepted");
      return accepted || subs[0]; 
    });
    
    const acceptedSubmissions = processedSubmissions.filter(
      (sub) => sub.status === "Accepted"
    );

    console.log("Total processed submissions:", processedSubmissions.length);
    console.log("Accepted submissions:", acceptedSubmissions.length);
    console.log(
      "First submission (sample):",
      processedSubmissions.length > 0
        ? JSON.stringify(processedSubmissions[0], null, 2)
        : "None"
    );

    const currentProblemsMap = {};
    user.solvedProblems.forEach((sp) => {
      currentProblemsMap[sp.problem] = {
        submissionId: sp.submissionId,
        status: sp.status || "Accepted" 
      };
    });

    const newSolvedProblems = [];
    
    processedSubmissions.forEach((sub) => {
      const problemSlug = sub.problemSlug;
      const newProblem = {
        problem: problemSlug,
        submissionId: sub.submissionId || sub.id || null,
        status: sub.status
      };
      
      if (currentProblemsMap[problemSlug]) {
        const currentStatus = currentProblemsMap[problemSlug].status;
        if (sub.status === "Accepted" && currentStatus !== "Accepted") {
          const index = user.solvedProblems.findIndex(p => p.problem === problemSlug);
          if (index !== -1) {
            user.solvedProblems[index].status = "Accepted";
            user.solvedProblems[index].submissionId = newProblem.submissionId;
          }
        }
      } else {
        newSolvedProblems.push(newProblem);
      }
    });

    console.log("New problems to be added:", newSolvedProblems.length);
    if (newSolvedProblems.length > 0) {
      console.log("Sample new problem:", JSON.stringify(newSolvedProblems[0], null, 2));
      user.solvedProblems = [...user.solvedProblems, ...newSolvedProblems];
      await user.save();
    } else if (user.isModified()) {
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


router.get('/:username/checkpoint', async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json({ 
      lastScrapedSubmissionId: user.lastScrapedSubmissionId || null 
    });
  } catch (error) {
    console.error('Error retrieving checkpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete("/:username/remove-friend", async (req, res) => {
  try {
    console.log('=== REMOVE FRIEND ENDPOINT ===');
    console.log('Username:', req.params.username);
    console.log('Friend username from request:', req.body.friendUsername);
    
    const { friendUsername } = req.body;
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const friend = await User.findOne({ username: friendUsername });
    if (!friend) return res.status(404).json({ message: "Friend not found" });
    
    console.log('Friend found:', friend ? 'Yes' : 'No');

    // Check if they are actually friends
    const friendIndex = user.friends.findIndex(fid => fid.toString() === friend._id.toString());
    if (friendIndex === -1) {
      return res.status(400).json({ message: "Friend not found in your friends list" });
    }

    // Remove friend from user's friends array
    user.friends.splice(friendIndex, 1);
    await user.save();
    console.log('Friend removed successfully');

    res.json({ message: `${friendUsername} has been removed from your friends list` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
