const CryptoJS = require('crypto-js');
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 16; // 128 bits
    
    // Primary encryption key from environment
    this.masterKey = process.env.ENCRYPTION_KEY || this.generateRandomKey();
    
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('⚠️  ENCRYPTION_KEY not set in environment variables. Using generated key (NOT SECURE FOR PRODUCTION!)');
    }
  }

  /**
   * Generate a random encryption key
   * @returns {string} Base64 encoded random key
   */
  generateRandomKey() {
    return crypto.randomBytes(this.keyLength).toString('base64');
  }

  /**
   * Derive a key from the master key and salt
   * @param {string} salt - Base64 encoded salt
   * @returns {Buffer} Derived key
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(
      this.masterKey, 
      Buffer.from(salt, 'base64'),
      100000, // iterations
      this.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt plaintext with AES-256-GCM
   * @param {string} plaintext - Text to encrypt
   * @param {string} keyId - Optional key identifier for key rotation
   * @returns {object} Encrypted data with metadata
   */
  encrypt(plaintext, keyId = 'default') {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a non-empty string');
      }

      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive key from master key and salt
      const derivedKey = this.deriveKey(salt.toString('base64'));
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, derivedKey);
      cipher.setAAD(Buffer.from(keyId, 'utf8')); // Additional authenticated data
      
      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine all components
      const result = {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        tag: tag.toString('base64'),
        keyId: keyId,
        algorithm: this.algorithm,
        version: '1.0'
      };

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt ciphertext encrypted with encrypt()
   * @param {object} encryptedData - Object returned by encrypt()
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== 'object') {
        throw new Error('Invalid encrypted data format');
      }

      const { encrypted, iv, salt, tag, keyId = 'default', algorithm } = encryptedData;
      
      if (!encrypted || !iv || !salt || !tag) {
        throw new Error('Missing encryption components');
      }

      if (algorithm && algorithm !== this.algorithm) {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }

      // Derive the same key used for encryption
      const derivedKey = this.deriveKey(salt);
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, derivedKey);
      decipher.setAAD(Buffer.from(keyId, 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      
      // Decrypt
      let decrypted = decipher.update(Buffer.from(encrypted, 'base64'));
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt data based on confidentiality level
   * @param {string} data - Data to encrypt
   * @param {number} confidentialityLevel - 1, 2, or 3
   * @returns {object} Encrypted data with level-specific key
   */
  encryptByLevel(data, confidentialityLevel = 1) {
    const keyId = this.getKeyIdByLevel(confidentialityLevel);
    return this.encrypt(data, keyId);
  }

  /**
   * Get key identifier based on confidentiality level
   * @param {number} level - Confidentiality level (1-3)
   * @returns {string} Key identifier
   */
  getKeyIdByLevel(level) {
    switch (level) {
      case 3: return 'confidential-l3';
      case 2: return 'sensitive-l2';
      case 1:
      default: return 'general-l1';
    }
  }

  /**
   * Hash password using bcrypt-like approach with crypto
   * @param {string} password - Plain password
   * @returns {string} Hashed password
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain password
   * @param {string} hash - Stored hash
   * @returns {boolean} Match result
   */
  verifyPassword(password, hash) {
    const [salt, storedHash] = hash.split(':');
    const hashToVerify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return storedHash === hashToVerify;
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} Random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Simple client-side encryption using CryptoJS (for demo purposes)
   * In production, this would be handled by the frontend
   * @param {string} text - Text to encrypt
   * @param {string} password - Password for encryption
   * @returns {string} Encrypted string
   */
  clientSideEncrypt(text, password) {
    return CryptoJS.AES.encrypt(text, password).toString();
  }

  /**
   * Simple client-side decryption using CryptoJS
   * @param {string} encryptedText - Encrypted text
   * @param {string} password - Password for decryption
   * @returns {string} Decrypted text
   */
  clientSideDecrypt(encryptedText, password) {
    const bytes = CryptoJS.AES.decrypt(encryptedText, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = {
  EncryptionService,
  encryptionService
};