import type { UserCardDetail } from "@frontend-monorepo/http-client-borrower";
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
      className="flex space-x-3 text-xl tracking-wider
             cursor-copy hover:bg-dark-600 active:bg-dark active:cursor-default
             b-2 rounded-md transition-colors"
      style={{ fontFamily: "PayWithMoonFont" }}
      onClick={() => handleCopy()}
    >
      {groups.map((group, index) => <span key={index}>{group}</span>)}
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
    <div className="flex space-x-3 text-md tracking-wider" style={{ fontFamily: "PayWithMoonFont" }}>
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
    <div className="flex space-x-3 text-md tracking-wider" style={{ fontFamily: "PayWithMoonFont" }}>
      {formatted}
    </div>
  );
};

export default function CreditCard({ card, visible, setVisible }: CredtCardProps) {
  return (
    <Box className="relative flex items-center justify-center w-[320px] h-[200px]">
      {/* Background image */}
      <div className="overflow-hidden w-full h-full">
        <div className="absolute inset-0">
          <MoonCard className="object-cover w-full h-full" />
        </div>
        <div className="absolute bottom-10 left-3 transform -translate-y-1/2 text-white text-center p-2 rounded">
          <CardNumber pan={card.pan} visible={visible} setVisible={setVisible}></CardNumber>
        </div>
        <div className="absolute bottom-4 left-3 text-white text-center p-2 rounded">
          <ExpirationDate expiry={card.expiration} visible={visible} />
        </div>
        <div className="absolute bottom-4 left-44 transform -translate-x-1 text-white text-center p-2 rounded">
          <Cvv cvv={card.cvv} visible={visible} />
        </div>
      </div>
    </Box>
  );
}
