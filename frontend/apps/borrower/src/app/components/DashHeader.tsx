interface DashInterface {
  label: string;
}

export default function DashHeader(props: DashInterface) {
  return (
    <div className="px-6 py-3 md:px-8">
      <div className="flex justify-between">
        <h2 className="text-2xl font-medium text-font dark:text-font-dark">
          {props.label}
        </h2>
      </div>
    </div>
  );
}
