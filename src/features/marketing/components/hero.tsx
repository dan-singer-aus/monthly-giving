import { ArrowUpRight, CirclePlay } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import Home from '@/app/page';
import HomepageCta from './homepage-cta';

export default function Hero() {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-primary text-primary-foreground">
      <div className="mx-auto grid w-full max-w-(--breakpoint-xl) gap-12 px-6 py-12 lg:grid-cols-2 lg:py-0">
        <div className="relative aspect-video w-full rounded-xl bg-accent lg:aspect-auto lg:h-screen lg:w-[1000px] lg:justify-self-end lg:rounded-none">
          <Image
            src="/Hero.webp"
            alt="Hero Image"
            fill
            className="object-cover"
          />
        </div>
        <div className="my-auto">
          <h1 className="mt-6 max-w-[17ch] font-semibold text-4xl leading-[1.2]! tracking-[-0.035em] md:text-5xl lg:text-[2.75rem] xl:text-[3.25rem]">
            Supporting the Future of Scotch College
          </h1>
          <p className="mt-6 max-w-[60ch] text-primary-foreground text-lg">
            Your monthly gift. Their lasting legacy.
          </p>
          <p className="mt-6 max-w-[60ch] text-primary-foreground text-lg">
            As you graduate and move forward into the world, you carry with you
            the values, friendships, and opportunities that Scotch College
            helped shape. Life Support is your chance to give back in a simple
            yet powerful way. Starting with just $1 a month in your first year
            out, and growing by $1 each year, your commitment becomes a ripple
            of support that strengthens the future of Scotch for generations to
            come.
          </p>
          <p className="mt-6 max-w-[60ch] text-primary-foreground text-lg">
            Whether you're leaving Year 12 now or graduated decades ago, Life
            Support invites every Old Scotch Collegian to play a part. Your
            monthly gift fuels scholarships, facilities, and programs that
            enrich every student’s journey. Together, one small step at a time,
            we can ensure Scotch remains a place where young people are inspired
            to thrive, lead, and give back—just like you.
          </p>
          <div className="mt-12 flex items-center gap-4">
            <HomepageCta />
          </div>
        </div>
      </div>
    </div>
  );
}
