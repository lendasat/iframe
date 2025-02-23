import type { UserCardDetail } from "@frontend/http-client-borrower";
import { Box } from "@radix-ui/themes";
import { ReactComponent as MoonCard } from "../../assets/moon_card.svg";
import "../../assets/moonFont.css";

interface CredtCardProps {
  card: UserCardDetail;
  visible?: boolean;
  setVisible: (value: ((prevState: boolean) => boolean) | boolean) => void;
}

interface CardNumberProps {
  pan: string;
  visible?: boolean;
  setVisible: (value: ((prevState: boolean) => boolean) | boolean) => void;
}

const CardNumber = ({ pan, visible, setVisible }: CardNumberProps) => {
  let groups = pan.match(/.{1,4}/g) || [];
  if (!visible) {
    groups = ["****", "****", "****", groups[3]];
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pan);
      setVisible(!visible);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div
      className="hover:bg-dark-600 active:bg-dark b-2 flex cursor-copy space-x-3 rounded-md text-xl tracking-wider transition-colors active:cursor-default"
      style={{ fontFamily: "PayWithMoonFont" }}
      onClick={() => handleCopy()}
    >
      {groups.map((group, index) => (
        <span key={index}>{group}</span>
      ))}
    </div>
  );
};

interface ExpirationDateProps {
  expiry: string;
  visible: boolean | undefined;
}

const ExpirationDate = ({ expiry, visible }: ExpirationDateProps) => {
  let formatted = "**/****";
  if (visible) {
    formatted = expiry;
  }

  return (
    <div
      className="text-md flex space-x-3 tracking-wider"
      style={{ fontFamily: "PayWithMoonFont" }}
    >
      {formatted}
    </div>
  );
};

interface CvvProps {
  cvv: string;
  visible: boolean | undefined;
}

const Cvv = ({ cvv, visible }: CvvProps) => {
  let formatted = "***";
  if (visible) {
    formatted = cvv;
  }

  return (
    <div
      className="text-md flex space-x-3 tracking-wider"
      style={{ fontFamily: "PayWithMoonFont" }}
    >
      {formatted}
    </div>
  );
};

export default function CreditCard({
  card,
  visible,
  setVisible,
}: CredtCardProps) {
  return (
    <Box className="relative flex h-[200px] w-[320px] items-center justify-center">
      {/* Background image */}
      <div className="h-full w-full overflow-hidden">
        <div className="absolute inset-0">
          <MoonCard className="h-full w-full object-cover" />
        </div>
        <div className="absolute bottom-10 left-3 -translate-y-1/2 transform rounded p-2 text-center text-white">
          <CardNumber
            pan={card.pan}
            visible={visible}
            setVisible={setVisible}
          ></CardNumber>
        </div>
        <div className="absolute bottom-4 left-3 rounded p-2 text-center text-white">
          <ExpirationDate expiry={card.expiration} visible={visible} />
        </div>
        <div className="absolute bottom-4 left-44 -translate-x-1 transform rounded p-2 text-center text-white">
          <Cvv cvv={card.cvv} visible={visible} />
        </div>
      </div>
    </Box>
  );
}
