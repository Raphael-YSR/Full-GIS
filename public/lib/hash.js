const bcrypt = require('bcrypt');

async function hashPassword(plainPassword) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    console.log("Generated Hashed Password:", hashedPassword);
}

hashPassword("Missed");


