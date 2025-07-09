import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Users, Mail, Phone, MapPin, Shield, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const signupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  address: z.string().min(5, "Please enter your address"),
  city: z.string().min(2, "Please enter your city"),
  state: z.string().min(2, "Please enter your state"),
  zipCode: z.string().min(5, "Please enter a valid ZIP code"),
  role: z.enum(["volunteer", "host", "driver", "coordinator"]),
  availability: z.array(z.string()).min(1, "Please select at least one availability option"),
  interests: z.array(z.string()).optional(),
  emergencyContact: z.string().min(5, "Please provide emergency contact information"),
  agreeToTerms: z.boolean().refine(val => val === true, "You must agree to the terms and conditions"),
  agreeToBackground: z.boolean().optional(),
});

type SignupForm = z.infer<typeof signupSchema>;

const availabilityOptions = [
  "Monday Morning", "Monday Afternoon", "Monday Evening",
  "Tuesday Morning", "Tuesday Afternoon", "Tuesday Evening", 
  "Wednesday Morning", "Wednesday Afternoon", "Wednesday Evening",
  "Thursday Morning", "Thursday Afternoon", "Thursday Evening",
  "Friday Morning", "Friday Afternoon", "Friday Evening",
  "Saturday Morning", "Saturday Afternoon", "Saturday Evening",
  "Sunday Morning", "Sunday Afternoon", "Sunday Evening",
  "Weekends Only", "Weekdays Only", "Flexible Schedule"
];

const interestOptions = [
  "Food Collection", "Food Distribution", "Transportation/Driving",
  "Event Planning", "Administrative Support", "Marketing/Outreach",
  "Technology Support", "Fundraising", "Community Partnerships",
  "Volunteer Coordination", "Data Management", "Special Events"
];

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      role: "volunteer",
      availability: [],
      interests: [],
      emergencyContact: "",
      agreeToTerms: false,
      agreeToBackground: false,
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      return await apiRequest("/api/auth/signup", "POST", data);
    },
    onSuccess: () => {
      toast({ 
        title: "Registration Successful", 
        description: "Welcome to The Sandwich Project! Please check your email for next steps." 
      });
      setCurrentStep(4); // Success step
    },
    onError: (error: any) => {
      toast({ 
        title: "Registration Failed", 
        description: error.message || "There was an error creating your account. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: SignupForm) => {
    const formData = {
      ...data,
      availability: selectedAvailability,
      interests: selectedInterests,
    };
    signupMutation.mutate(formData);
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (currentStep === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Aboard!</h2>
            <p className="text-gray-600 mb-6">
              Your registration has been submitted successfully. We'll review your application and contact you soon with next steps.
            </p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/">Return to Home</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Join The Sandwich Project</CardTitle>
          <CardDescription className="text-lg">
            Help us fight hunger in our community - Step {currentStep} of 3
          </CardDescription>
          <div className="flex justify-center mt-4">
            <div className="flex space-x-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full ${
                    step <= currentStep ? 'bg-[#236383]' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xl font-semibold">Personal Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your first name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Your city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 2: Role and Availability */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xl font-semibold">Your Role & Availability</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How would you like to help?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your preferred role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="volunteer">General Volunteer</SelectItem>
                            <SelectItem value="host">Host Location</SelectItem>
                            <SelectItem value="driver">Driver/Transportation</SelectItem>
                            <SelectItem value="coordinator">Team Coordinator</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label className="text-sm font-medium">When are you available? (Select all that apply)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {availabilityOptions.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={option}
                            checked={selectedAvailability.includes(option)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAvailability([...selectedAvailability, option]);
                              } else {
                                setSelectedAvailability(selectedAvailability.filter(item => item !== option));
                              }
                            }}
                          />
                          <Label htmlFor={option} className="text-sm">{option}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Areas of Interest (Optional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {interestOptions.map((interest) => (
                        <div key={interest} className="flex items-center space-x-2">
                          <Checkbox
                            id={interest}
                            checked={selectedInterests.includes(interest)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedInterests([...selectedInterests, interest]);
                              } else {
                                setSelectedInterests(selectedInterests.filter(item => item !== interest));
                              }
                            }}
                          />
                          <Label htmlFor={interest} className="text-sm">{interest}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Information</FormLabel>
                        <FormControl>
                          <Input placeholder="Name and phone number of emergency contact" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Terms and Conditions */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xl font-semibold">Terms & Agreement</h3>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">The Sandwich Project Terms of Service</h4>
                    <div className="text-sm text-gray-600 space-y-2 max-h-40 overflow-y-auto">
                      <p>By joining The Sandwich Project, you agree to:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Volunteer in a safe and respectful manner</li>
                        <li>Follow all food safety and handling guidelines</li>
                        <li>Represent the organization professionally</li>
                        <li>Respect the privacy of all community members</li>
                        <li>Participate in required training sessions</li>
                        <li>Report any safety concerns immediately</li>
                      </ul>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="agreeToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the terms and conditions of The Sandwich Project
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="agreeToBackground"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I consent to a background check (required for certain volunteer roles)
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Next Steps:</strong> After submitting your application, our volunteer coordinator will review your information and contact you within 2-3 business days with orientation details and next steps.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  Previous
                </Button>
                
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={signupMutation.isPending}
                  >
                    {signupMutation.isPending ? "Submitting..." : "Complete Registration"}
                  </Button>
                )}
              </div>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}