type HeaderProps = {
  title: string;
};

export function HeaderComponent({ title }: HeaderProps) {
  return <h1>{title}</h1>;
}

export default HeaderComponent;
