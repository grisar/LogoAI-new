import fs from 'fs/promises';
import path from 'path';

export class StorageService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  async saveBase64Image(base64Data, filename) {
    try {
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Image, 'base64');
      const filepath = path.join(this.uploadDir, filename);
      await fs.writeFile(filepath, buffer);

      return `/uploads/${filename}`;
    } catch (error) {
      console.error('Error saving base64 image:', error);
      throw error;
    }
  }

  async deleteFile(filepath) {
    try {
      const fullPath = path.join(process.cwd(), filepath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  async generateFilename(prefix, extension = 'png') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }
}