import { C } from '../lib/theme.js';

const variants = {
  primary: 'btn-primary',
  dark: 'btn-dark',
  outline: 'btn-outline',
};

const sizes = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export default function Btn({ variant = 'primary', size = 'md', children, ...props }) {
  return (
    <button className={`btn ${variants[variant]} ${sizes[size]}`} {...props}>
      {children}
    </button>
  );
}
