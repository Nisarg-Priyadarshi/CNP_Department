/* Shared marks for the student dashboard. Inline SVG on a 24 grid, stroked with
   the current ink so they inherit hover and disabled states. Entity glyphs come
   from `components/ui/vis` (KindGlyph); these are the utility marks. */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg
      className="sd-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <path d="M4 10h16M8 3v4m8-4v4" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c4-4.3 7-7.7 7-11a7 7 0 1 0-14 0c0 3.3 3 6.7 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.3 4.3 3.5 16a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4m0 3h.01" />
    </Icon>
  );
}

/** Team lead: the crown, the same mark the project board uses. */
export function LeadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.2 16.6 4 6.6l4.8 3.6L12 5.2l3.2 5 4.8-3.6-1.2 10Z" />
      <path d="M5.2 19.4h13.6" />
    </Icon>
  );
}

/** A request still waiting: an open ring, the only mark that is not a solid. */
export function PendingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.4" strokeDasharray="3 2.6" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** The faculty mentor: one star, legible at 14px. */
export function MentorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.2 14.3 9l5.3.8-3.8 3.7.9 5.3L12 16.3l-4.7 2.5.9-5.3L4.4 9.8 9.7 9Z" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.6 12.6 4.6 4.4 10-10.4" />
    </Icon>
  );
}

/** Core team: a solid plinth. Member: a hollow one. Neither carries meaning by
    colour alone — the role word sits beside it. */
export function CoreMark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.4 19 8.6 12 12.8 5 8.6Z" />
    </Icon>
  );
}

export function MemberMark(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.4" />
    </Icon>
  );
}
