#!/usr/bin/env node

const readline = require('readline');
const bcrypt = require('bcrypt');
const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  // Must be at least 8 characters, contain uppercase, lowercase, number, and special char
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
}

async function createAdmin() {
  try {
    console.log('\n✨ Create Admin Account\n');
    console.log('This tool helps you create new admin or staff accounts.\n');

    // Get user details
    const fullName = await prompt('Full Name: ');
    const username = await prompt('Username: ');
    const email = await prompt('Email: ');
    const phone = await prompt('Phone (optional): ');
    
    const roles = ['admin', 'staff'];
    const roleChoice = await prompt('Role (admin/staff) [default: admin]: ');
    const role = roles.includes(roleChoice) ? roleChoice : 'admin';

    // Validate email
    if (!validateEmail(email)) {
      console.error('\n❌ Invalid email format!');
      rl.close();
      process.exit(1);
    }

    // Get password with validation
    let password;
    let passwordValid = false;
    while (!passwordValid) {
      password = await prompt('Password (min 8 chars, uppercase, lowercase, number, special char): ');
      if (!validatePassword(password)) {
        console.log('❌ Password does not meet requirements. Please try again.');
        console.log('   Requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char (@$!%*?&)');
        continue;
      }
      passwordValid = true;
    }

    const confirmPassword = await prompt('Confirm Password: ');
    if (password !== confirmPassword) {
      console.error('\n❌ Passwords do not match!');
      rl.close();
      process.exit(1);
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert into database
    const conn = await pool.getConnection();
    try {
      const result = await conn.query(
        'INSERT INTO users (full_name, username, email, phone, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [fullName || username, username, email, phone || null, hashedPassword, role]
      );

      console.log('\n✅ Admin account created successfully!\n');
      console.log('Account Details:');
      console.log(`  Full Name: ${fullName || username}`);
      console.log(`  Username: ${username}`);
      console.log(`  Email: ${email}`);
      console.log(`  Role: ${role}`);
      console.log(`  Status: Active`);
      console.log('\n');
      
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.error('\n❌ Username or email already exists!');
      } else {
        console.error('\n❌ Error creating account:', error.message);
      }
      rl.close();
      process.exit(1);
    } finally {
      conn.release();
    }

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Run the CLI
createAdmin();
