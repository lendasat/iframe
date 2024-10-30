import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { AlertDialog, Box, Button, Checkbox, Flex, Separator, Text } from "@radix-ui/themes";
import { type ReactElement, useState } from "react";
import Bitrefil from "../../../assets/bitrefil.png";
import Defi from "../../../assets/defi.jpg";
import Moon from "../../../assets/moon.jpg";
import Sepa from "../../../assets/sepa.jpg";
import "./../../components/scrollbar.css";

interface Step1Props {
  onSelect: (option: LoanProductOption) => void;
  selectedOption?: LoanProductOption;
}

export const Step1PickOption = ({ onSelect, selectedOption }: Step1Props) => {
  const { enabledFeatures } = useAuth();

  return (
    <Box className="py-6 md:py-8 grid md:grid-cols-2 xl:grid-cols-3 gap-5 px-6 md:px-8">
      {enabledFeatures.map((option, index) => {
        switch (option) {
          case LoanProductOption.PayWithMoonDebitCard:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Debit card by PayWithMoon"}
                key={index}
                image={<img src={Moon} alt="PayWithMoon" />}
              />
            );
          case LoanProductOption.StableCoins:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Receive stable coins"}
                key={index}
                image={<img src={Defi} alt="DEFI" />}
              />
            );
          case LoanProductOption.BringinBankAccount:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"To a bank account using SEPA via Bringin"}
                key={index}
                image={<img src={Sepa} alt="SEPA" />}
              />
            );
          case LoanProductOption.BitrefillDebitCard:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"A debit card by Bitrefill"}
                key={index}
                image={<img src={Bitrefil} alt="Bitrefil" />}
              />
            );
          default:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Receive stable coins"}
                key={index}
                image={<img src={Defi} alt="DEFI" />}
              />
            );
        }
      })}
    </Box>
  );
};

interface ProductOptionComponentProps {
  onSelect: (option: LoanProductOption) => void;
  option: LoanProductOption | LoanProductOption.PayWithMoonDebitCard;
  selectedOption: LoanProductOption | undefined;
  title: string;
  image: ReactElement;
}

function ProductOptionComponent({
  onSelect,
  option,
  selectedOption,
  title,
  image,
}: ProductOptionComponentProps) {
  const isSelected = selectedOption === option;
  const [checked, setChecked] = useState<LoanProductOption | undefined>(undefined);
  const isChecked = checked === option;

  return (
    <Box className="text-left w-full max-w-[350px]">
      <Text as="p" size={"3"} weight={"bold"}>
        {title}
      </Text>
      <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
        {image}
      </Box>
      <AlertDialog.Root>
        <AlertDialog.Trigger
          onClick={(e) => {
            if (isSelected) {
              e.preventDefault();
            } else {
              setChecked(undefined);
            }
          }}
        >
          <Button
            variant="soft"
            size={"3"}
            color={isSelected ? "purple" : "gray"}
            className="w-full"
          >
            {isSelected ? "Selected" : "Select"}
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Content maxWidth="450px" className="rounded-lg">
          <Box className="py-4 text-center max-w-sm mx-auto">
            <Flex align={"center"} justify={"center"} gap={"3"} pb={'1'}>
              <Separator size={"3"} className="bg-font/30" />
              <AlertDialog.Title className="shrink-0 p-0 m-0">Terms of service</AlertDialog.Title>
              <Separator size={"3"} className="bg-font/30" />
            </Flex>
            <Text size={"2"} className="text-font/70">
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Eum est numquam consequuntur.
            </Text>
          </Box>
          <Box className="relative bg-slate-50 py-3">
            <Box className="max-h-72 overflow-y-scroll p-4 custom-scrollbar">
              <AlertDialog.Description size="2" className="text-pretty leading-[1.8] text-font/60">
                Lorem, ipsum dolor sit amet consectetur adipisicing elit. Ex facere voluptatem eaque ducimus cupiditate
                voluptate culpa voluptas qui, iusto praesentium nam? Reiciendis aspernatur mollitia, sapiente, similique
                fuga odio nisi vel cupiditate blanditiis ipsum corrupti molestiae facere voluptates autem architecto
                accusantium nulla nam harum laborum nesciunt a! Quas dicta neque voluptas tempora voluptates nemo
                placeat impedit veritatis, mollitia repudiandae velit molestiae? Nostrum quisquam minima obcaecati
                consectetur. Distinctio, debitis deleniti! Nobis alias, sapiente quam soluta perferendis, tempora
                obcaecati eaque, optio accusamus quasi laboriosam animi voluptatem quia itaque. Libero similique iste ea
                eum perspiciatis obcaecati enim inventore provident aliquid fugiat beatae, quas non vel eveniet deserunt
                veritatis pariatur iusto quod ipsum. Expedita eos cum quos iusto eaque perferendis mollitia, doloribus
                adipisci. Perferendis numquam ad minus itaque dicta dolor quas autem velit, voluptatum repellendus est
                tenetur sit repudiandae modi quisquam eum ab, eligendi porro sint temporibus natus corporis incidunt?
                Amet possimus reiciendis vero laboriosam impedit aliquam sequi, culpa nesciunt consequatur tempore ipsa
                a minima temporibus at illo corporis reprehenderit error cum sapiente doloribus voluptates! Saepe
                praesentium itaque quasi, atque rerum facilis nisi similique molestiae deserunt dolore ipsa consequatur
                provident voluptates ipsum voluptatibus recusandae illo sint excepturi repellendus nihil error totam
                non. Eius ullam sed ut dignissimos ad delectus, illo animi fugiat voluptas facere expedita tenetur
                praesentium facilis soluta sunt, nemo quisquam. Animi ducimus recusandae sint molestiae illo reiciendis
                porro velit, laudantium deleniti fugit consectetur alias eligendi odit veritatis eum mollitia distinctio
                vel cum architecto accusamus cupiditate nihil. Cum laborum provident vel, vero asperiores ipsam
                consequatur. Impedit laborum, enim molestias placeat minus aperiam corporis aspernatur natus iure magni
                qui tempore recusandae repellat facilis blanditiis inventore tenetur ipsam aliquid non cum doloremque
                labore quibusdam praesentium. Cum ab porro sit odio commodi laboriosam iste quia ratione ullam veritatis
                tenetur cupiditate provident explicabo, dolorum temporibus nisi, officia laborum exercitationem
                voluptate ducimus vero eligendi non aliquam? Enim debitis tenetur adipisci quas fugit iusto rerum?
              </AlertDialog.Description>
            </Box>
            <div className="absolute bottom-0 h-7 bg-gradient-to-t from-white via-white/70 to-white/0 z-10 w-full left-0" />
          </Box>
          <Box py={"3"} className="px-4">
            <Text as="label" size="2" weight={"medium"}>
              <Flex gap="2">
                <Checkbox
                  color="purple"
                  variant="soft"
                  checked={isChecked}
                  onCheckedChange={() => {
                    if (isChecked) {
                      setChecked(undefined);
                    } else {
                      setChecked(option);
                    }
                  }}
                />
                Agree to Terms and Conditions
              </Flex>
            </Text>
          </Box>
          <Flex gap="3" mt="4" justify="center" align={"center"}>
            <AlertDialog.Cancel className="grow">
              <Button variant="outline" size={"3"} className="text-sm" color="gray">
                Decline
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action className="grow">
              <Button
                onClick={() => onSelect(option)}
                disabled={!checked}
                variant="solid"
                size={"3"}
                color="purple"
                className="text-sm"
              >
                Continue
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
