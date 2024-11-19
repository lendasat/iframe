import type { UserCardDetail } from "@frontend-monorepo/http-client-borrower";
import { Box } from "@radix-ui/themes";
import Moon from "../../assets/moon_card.png";
import { formatExpiryTimestamp } from "./Cards";

interface CredtCardProps {
  card: UserCardDetail;
  visible?: boolean;
  setVisible: (value: ((prevState: boolean) => boolean) | boolean) => void;
}

interface CardNumberProps {
  number: number;
  visible?: boolean;
  setVisible: (value: ((prevState: boolean) => boolean) | boolean) => void;
}

const CardNumber = ({ number, visible, setVisible }: CardNumberProps) => {
  let groups = number.toString().match(/.{1,4}/g) || [];
  if (!visible) {
    groups = ["****", "****", "****", groups[3]];
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(number.toString());
      setVisible(!visible);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div
      className="flex space-x-3 text-xl font-mono tracking-wider
             cursor-copy hover:bg-gray-600 active:bg-gray-900 active:cursor-default
             b-2 rounded-md transition-colors"
      onClick={() => handleCopy()}
    >
      {groups.map((group, index) => <span key={index}>{group}</span>)}
    </div>
  );
};

interface ExpirationDateProps {
  expiry: Date;
  visible: boolean | undefined;
}

const ExpirationDate = ({ expiry, visible }: ExpirationDateProps) => {
  let formatted = "**/****";
  if (visible) {
    formatted = formatExpiryTimestamp(expiry.getTime());
  }

  return (
    <div className="flex space-x-3 text-md font-mono tracking-wider">
      {formatted}
    </div>
  );
};

interface CvvProps {
  cvv: number;
  visible: boolean | undefined;
}

const Cvv = ({ cvv, visible }: CvvProps) => {
  let formatted = "***";
  if (visible) {
    formatted = cvv.toString();
  }

  return (
    <div className="flex space-x-3 text-md font-mono tracking-wider">
      {formatted}
    </div>
  );
};

export default function CreditCard({ card, visible, setVisible }: CredtCardProps) {
  return (
    <Box>
      {/* Background image */}
      <div className="overflow-hidden">
        <div className="absolute inset-0">
          <img src={Moon} alt="Card background" className="object-cover" />
        </div>
        <div className="absolute bottom-10 left-3 transform -translate-y-1/2 text-white text-center p-2 rounded">
          <CardNumber number={card.pan} visible={visible} setVisible={setVisible}></CardNumber>
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
