interface AvatarProps {
  url: string;
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ url, name, size = 36, className = "" }: AvatarProps) {
  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className={`rounded-lg object-cover flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
