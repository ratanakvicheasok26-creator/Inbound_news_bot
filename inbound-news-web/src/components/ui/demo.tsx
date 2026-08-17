import { PricingSection } from "@/components/ui/pricing";

// Demo data for the pricing plans
const demoPlans = [
  {
    name: "Starter",
    price: "50",
    yearlyPrice: "40",
    period: "month",
    features: [
      "Up to 10 projects",
      "Basic analytics",
      "48-hour support response time",
      "Limited API access",
      "Community support",
    ],
    description: "Perfect for individuals and small projects.",
    buttonText: "Start Free Trial",
    href: "#",
  },
  {
    name: "Professional",
    price: "99",
    yearlyPrice: "79",
    period: "month",
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "24-hour support response time",
      "Full API access",
      "Priority support & Team collaboration",
    ],
    description: "Ideal for growing teams and businesses.",
    buttonText: "Get Started",
    href: "#",
    isPopular: true,
  },
  {
    name: "Enterprise",
    price: "299",
    yearlyPrice: "239",
    period: "month",
    features: [
      "Everything in Professional",
      "Custom solutions & integrations",
      "Dedicated account manager",
      "SSO Authentication & Advanced security",
    ],
    description: "For large organizations with specific needs.",
    buttonText: "Contact Sales",
    href: "#",
  },
];

// Demo component to showcase the PricingSection
export default function PricingSectionDemo() {
  return (
    <PricingSection
      plans={demoPlans}
      title="Find the Perfect Plan"
      description="Select the ideal package for your needs and start building today."
    />
  );
}
