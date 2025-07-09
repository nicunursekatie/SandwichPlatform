import { Request, Response, NextFunction } from 'express';

// Simple HTML sanitization - removes potentially dangerous tags and attributes
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove script tags and their content
  let sanitized = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove potentially dangerous tags
  const dangerousTags = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 
    'textarea', 'select', 'option', 'link', 'meta', 'style', 'base'
  ];
  
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
    // Also remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  });
  
  // Remove dangerous attributes
  const dangerousAttrs = [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown', 
    'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange', 'onsubmit',
    'javascript:', 'vbscript:', 'data:'
  ];
  
  dangerousAttrs.forEach(attr => {
    const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, '');
  
  return sanitized.trim();
}

// Sanitize text content (for plain text fields)
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove HTML tags completely for plain text
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  sanitized = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&');
  
  return sanitized.trim();
}

// Middleware to sanitize request body
export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObjectRecursively(req.body);
  }
  next();
}

function sanitizeObjectRecursively(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        // Sanitize based on field type
        if (isHtmlField(key)) {
          obj[key] = sanitizeHtml(obj[key]);
        } else {
          obj[key] = sanitizeText(obj[key]);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObjectRecursively(obj[key]);
      }
    }
  }
}

// Determine if a field should allow limited HTML
function isHtmlField(fieldName: string): boolean {
  const htmlFields = [
    'content', 'description', 'notes', 'summary', 'text', 'html',
    'message', 'body', 'comment', 'details'
  ];
  return htmlFields.some(field => fieldName.toLowerCase().includes(field));
}