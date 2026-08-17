"use client";

import React, {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import Link from "next/link";
import { Check, Star as LucideStar } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILITY FUNCTIONS ---

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

// --- BASE UI COMPONENTS (BUTTON) ---

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-background/80 hover:bg-muted text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// --- HIGH-PERFORMANCE GPU-ACCELERATED STARFIELD ---
// Uses Canvas + requestAnimationFrame to avoid 150 React re-renders per frame

export function InteractiveStarfield({
  className,
}: {
  className?: string;
  mousePosition?: { x: number | null; y: number | null };
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", handleResize);

    // Generate 70 lightweight star particles
    const starCount = 70;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      size: 0.8 + Math.random() * 1.6,
      opacity: 0.2 + Math.random() * 0.7,
      blinkSpeed: 0.008 + Math.random() * 0.015,
      blinkOffset: Math.random() * Math.PI * 2,
    }));

    let mouseX: number | null = null;
    let mouseY: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const onMouseLeave = () => {
      mouseX = null;
      mouseY = null;
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener("mousemove", onMouseMove);
      parent.addEventListener("mouseleave", onMouseLeave);
    }

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < starCount; i++) {
        const star = stars[i];
        let targetX = star.baseX;
        let targetY = star.baseY;

        if (mouseX !== null && mouseY !== null) {
          const dx = mouseX - star.x;
          const dy = mouseY - star.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = 250;
          if (dist < radius && dist > 0) {
            const force = (1 - dist / radius) * 15;
            targetX = star.baseX + (dx / dist) * force;
            targetY = star.baseY + (dy / dist) * force;
          }
        }

        star.x += (targetX - star.x) * 0.05;
        star.y += (targetY - star.y) * 0.05;

        const currentOpacity = Math.max(
          0.1,
          star.opacity * (0.6 + 0.4 * Math.sin(time * star.blinkSpeed + star.blinkOffset)),
        );

        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * 0.65})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (parent) {
        parent.removeEventListener("mousemove", onMouseMove);
        parent.removeEventListener("mouseleave", onMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      style={{ opacity: 0.85 }}
    />
  );
}

// --- PRICING COMPONENT LOGIC ---

export interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular?: boolean;
}

export interface PricingSectionProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
}

export const PricingContext = createContext<{
  isMonthly: boolean;
  setIsMonthly: (value: boolean) => void;
}>({
  isMonthly: true,
  setIsMonthly: () => {},
});

// Main PricingSection Component
export function PricingSection({
  plans,
  title = "Find the Perfect Plan",
  description = "Select the ideal package for your needs and start building today.",
}: PricingSectionProps) {
  const [isMonthly, setIsMonthly] = useState(true);

  return (
    <PricingContext.Provider value={{ isMonthly, setIsMonthly }}>
      <div className="relative w-full bg-background dark:bg-neutral-950 py-16 sm:py-20 overflow-hidden">
        <InteractiveStarfield />
        <div className="relative z-10 container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg whitespace-pre-line">
              {description}
            </p>
          </div>
          <PricingToggle />
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch gap-6 lg:gap-8">
            {plans.map((plan, index) => (
              <PricingCard key={plan.name} plan={plan} index={index} />
            ))}
          </div>
        </div>
      </div>
    </PricingContext.Provider>
  );
}

// Pricing Toggle Component
export function PricingToggle() {
  const { isMonthly, setIsMonthly } = useContext(PricingContext);
  const toggleRef = useRef<HTMLDivElement>(null);
  const monthlyBtnRef = useRef<HTMLButtonElement>(null);
  const annualBtnRef = useRef<HTMLButtonElement>(null);

  const [pillStyle, setPillStyle] = useState<{ width: number; transform: string }>({
    width: 0,
    transform: "translateX(0px)",
  });

  const updatePill = useCallback(() => {
    const btnRef = isMonthly ? monthlyBtnRef : annualBtnRef;
    if (btnRef.current) {
      setPillStyle({
        width: btnRef.current.offsetWidth,
        transform: `translateX(${btnRef.current.offsetLeft}px)`,
      });
    }
  }, [isMonthly]);

  useEffect(() => {
    updatePill();
    window.addEventListener("resize", updatePill);
    return () => window.removeEventListener("resize", updatePill);
  }, [updatePill]);

  const handleToggle = (monthly: boolean) => {
    if (isMonthly === monthly) return;
    setIsMonthly(monthly);

    if (!monthly && toggleRef.current) {
      const rect = annualBtnRef.current?.getBoundingClientRect();
      if (!rect) return;

      const originX = (rect.left + rect.width / 2) / window.innerWidth;
      const originY = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x: originX, y: originY },
        colors: ["#FF0030", "#FFFFFF", "#2563EB", "#0F766E"],
        ticks: 200,
        gravity: 1.1,
        decay: 0.94,
        startVelocity: 25,
      });
    }
  };

  return (
    <div className="flex justify-center">
      <div
        ref={toggleRef}
        className="relative flex w-fit items-center rounded-full bg-neutral-900 border border-border p-1 shadow-inner"
      >
        <motion.div
          className="absolute left-0 top-1 h-[calc(100%-8px)] rounded-full bg-white dark:bg-neutral-100 shadow-md"
          animate={{
            width: pillStyle.width ? pillStyle.width - 4 : "50%",
            x: pillStyle.transform ? parseInt(pillStyle.transform.replace(/[^0-9-]/g, "")) + 2 : 2,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        <button
          ref={monthlyBtnRef}
          type="button"
          onClick={() => handleToggle(true)}
          className={cn(
            "relative z-10 rounded-full px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
            isMonthly
              ? "text-neutral-900"
              : "text-neutral-400 hover:text-neutral-200",
          )}
        >
          Monthly
        </button>
        <button
          ref={annualBtnRef}
          type="button"
          onClick={() => handleToggle(false)}
          className={cn(
            "relative z-10 rounded-full px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
            !isMonthly
              ? "text-neutral-900"
              : "text-neutral-400 hover:text-neutral-200",
          )}
        >
          Annual
          <span
            className={cn(
              "ml-1.5 text-xs font-bold",
              !isMonthly ? "text-primary" : "text-primary/90",
            )}
          >
            (Save 48%)
          </span>
        </button>
      </div>
    </div>
  );
}

// Pricing Card Component
export function PricingCard({ plan, index }: { plan: PricingPlan; index: number }) {
  const { isMonthly } = useContext(PricingContext);

  const priceValue = isMonthly ? Number(plan.price) : Number(plan.yearlyPrice);
  const periodLabel = isMonthly ? "mo" : "yr";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.08,
      }}
      className={cn(
        "rounded-2xl p-6 sm:p-8 flex flex-col relative bg-neutral-950/80 backdrop-blur-md transition-all duration-200 hover:border-neutral-700",
        plan.isPopular
          ? "border-2 border-primary shadow-xl shadow-primary/10"
          : "border border-border",
      )}
    >
      {plan.isPopular && (
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-primary py-1 px-3.5 rounded-full flex items-center gap-1.5 shadow-md">
            <LucideStar className="text-primary-foreground h-3.5 w-3.5 fill-current" />
            <span className="text-primary-foreground text-xs font-bold uppercase tracking-wider">
              Popular
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground min-h-[38px]">
          {plan.description}
        </p>

        <div className="mt-4 mb-2 flex items-baseline gap-x-1">
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            <NumberFlow
              value={priceValue}
              format={{
                style: "currency",
                currency: "USD",
                minimumFractionDigits: priceValue % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2,
              }}
              className="font-variant-numeric: tabular-nums"
            />
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            /{periodLabel}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mb-6">
          {isMonthly ? "Billed Monthly" : "Billed Annually"}
        </p>

        <ul role="list" className="space-y-3 text-xs sm:text-sm text-muted-foreground mb-8">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-x-2.5 items-start">
              <Check className="h-4 w-4 flex-none text-primary mt-0.5" aria-hidden="true" />
              <span className="text-neutral-300 leading-snug">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-2">
          <Link
            href={plan.href}
            className={cn(
              buttonVariants({
                variant: plan.isPopular ? "default" : "outline",
                size: "lg",
              }),
              "w-full",
            )}
          >
            {plan.buttonText}
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
