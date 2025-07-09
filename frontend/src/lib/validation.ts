import { z } from "zod";

// Common validation schemas
export const emailSchema = z.string().email("Please enter a valid email address");
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]{10,}$/, "Please enter a valid phone number");
export const requiredStringSchema = z.string().min(1, "This field is required");
export const optionalStringSchema = z.string().optional();

// Project validation schemas
export const projectSchema = z.object({
  title: z.string().min(1, "Project title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000, "Description must be less than 1000 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    errorMap: () => ({ message: "Please select a valid priority level" })
  }),
  status: z.enum(["available", "in_progress", "waiting", "completed"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  assignedTo: optionalStringSchema,
  dueDate: z.string().optional(),
  estimatedHours: z.number().min(0, "Estimated hours must be positive").optional(),
});

// Host validation schemas
export const hostSchema = z.object({
  name: z.string().min(1, "Host name is required").max(100, "Name must be less than 100 characters"),
  address: optionalStringSchema,
  status: z.enum(["active", "inactive", "pending"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  capacity: z.number().min(1, "Capacity must be at least 1").max(10000, "Capacity seems too high").optional(),
  notes: optionalStringSchema,
});

// Contact validation schemas
export const contactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(100, "Name must be less than 100 characters"),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  role: z.string().min(1, "Role is required").max(50, "Role must be less than 50 characters"),
  isPrimary: z.boolean().default(false),
}).refine((data) => data.email || data.phone, {
  message: "Either email or phone number is required",
  path: ["email"]
});

// Sandwich collection validation schemas
export const sandwichCollectionSchema = z.object({
  hostName: z.string().min(1, "Host name is required"),
  collectionDate: z.string().min(1, "Collection date is required"),
  sandwichCount: z.number().min(1, "Sandwich count must be at least 1").max(10000, "Count seems too high"),
  notes: optionalStringSchema,
});

// Meeting validation schemas
export const meetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required").max(200, "Title must be less than 200 characters"),
  description: optionalStringSchema,
  date: z.string().min(1, "Meeting date is required"),
  time: z.string().min(1, "Meeting time is required"),
  type: z.enum(["general", "committee", "planning", "emergency"], {
    errorMap: () => ({ message: "Please select a valid meeting type" })
  }),
  location: optionalStringSchema,
});

// Utility functions for form validation
export function validateField<T>(schema: z.ZodSchema<T>, value: unknown): { success: boolean; error?: string } {
  try {
    schema.parse(value);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Invalid input" };
    }
    return { success: false, error: "Validation failed" };
  }
}

export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    fieldErrors[path] = err.message;
  });
  return fieldErrors;
}

// Real-time validation hook
export function useFieldValidation<T>(schema: z.ZodSchema<T>) {
  return (value: unknown) => {
    try {
      schema.parse(value);
      return null; // No error
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || "Invalid input";
      }
      return "Validation failed";
    }
  };
}