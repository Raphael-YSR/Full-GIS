const bcrypt = require('bcrypt');

async function comparePasswords(plainPassword, hashedPassword) {
    try {
        const match = await bcrypt.compare(plainPassword, hashedPassword);
        console.log(match ? "✅ Password match!" : "❌ Incorrect password!");
    } catch (error) {
        console.error("Error comparing passwords:", error);
    }
}

// Example usage
const plainPassword = "Missed"; // Replace with actual password
const hashedPassword = "$2b$10$2PXw8YYfZooZ8tj4i/oHUOFWyVvaPyDwXJ.GZ0D/LRVvHTnOAwije"; // Paste the hashed password from Step 1

comparePasswords(plainPassword, hashedPassword);
