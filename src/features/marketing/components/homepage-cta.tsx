import { CircleHelpIcon } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/ui/tooltip';

export default function HomepageCta() {
  return (
    <Card className="w-full max-w-xs shadow-border/70 shadow-md bg-accent text-primary-foreground ">
      <CardHeader>
        <CardTitle className="font-semibold text-2xl tracking-tight">
          Pro Plan
        </CardTitle>
        <CardDescription>
          For teams that need advanced scheduling tools to streamline workflows
          and enhance collaboration, ensuring every meeting is productive and on
          track.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end text-muted-foreground text-sm leading-6">
        <span className="mt-1 font-semibold text-4xl text-foreground leading-none">
          $20
        </span>
        <span className="mr-1.5 ml-0.5">/mo</span>
        <Tooltip>
          <TooltipTrigger className="mb-1">
            <CircleHelpIcon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              Seats are required for users to connect calendars and create
              Calendly links to help book meetings - meeting invitees do not
              require an account or seat.
            </p>
          </TooltipContent>
        </Tooltip>
      </CardContent>
      <CardFooter className="mt-2 flex justify-between">
        <Button className="w-full bg-[#BE7588]" size="lg">
          Join the Club
        </Button>
      </CardFooter>
    </Card>
  );
}
