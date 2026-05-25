const variants = {
  primary: 'btn-primary',
  dark: 'btn-dark',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
};

const sizes = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export default function Btn({ variant = 'primary', size = 'md', children, className = '', ...props }) {
  return (
    <button className={`btn ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
