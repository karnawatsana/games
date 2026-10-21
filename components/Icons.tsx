type P = { size?: number };
const base = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const Home = ({ size }: P) => (<svg {...base(size)}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>);
export const Grid = ({ size }: P) => (<svg {...base(size)}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>);
export const Users = ({ size }: P) => (<svg {...base(size)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 010 6.6M18.5 14.8c1.6.8 2.7 2.4 3 5.2" /></svg>);
export const Plus = ({ size }: P) => (<svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const Arrow = ({ size }: P) => (<svg {...base(size)}><path d="M7 17L17 7M8 7h9v9" /></svg>);
export const Check = ({ size }: P) => (<svg {...base(size)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const Camera = ({ size }: P) => (<svg {...base(size)}><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const Flame = ({ size }: P) => (<svg {...base(size)}><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 2.5 1.5 2.5C10 9 11 6 12 3z" /></svg>);
export const Compass = ({ size }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>);
export const User = ({ size }: P) => (<svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></svg>);
export const List = ({ size }: P) => (<svg {...base(size)}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>);
export const Play = ({ size }: P) => (<svg {...base(size)} fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>);
export const Sparkle = ({ size }: P) => (<svg {...base(size)}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>);
