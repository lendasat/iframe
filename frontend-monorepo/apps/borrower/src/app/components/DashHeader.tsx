import HeaderNav from "./HeaderNav";

interface DashInterface {
  label: string;
}

export default function DashHeader(props: DashInterface) {
  return (
    <div className="flex justify-between items-center md:py-3">
      <h3 className="lg:text-4xl md:text-3xl text-2xl text-font-dark capitalize font-semibold">{props.label}</h3>
      <HeaderNav />
    </div>
  );
}
