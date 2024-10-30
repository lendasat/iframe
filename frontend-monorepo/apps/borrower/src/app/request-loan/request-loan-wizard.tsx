import type { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { Box, Button, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { useState } from "react";
import { CardBody, CardFooter } from "react-bootstrap";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import { IoIosCheckmarkCircle } from "react-icons/io";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Step1PickOption } from "./steps/step1PickOption";
import { Step2PickOffer } from "./steps/step2PickOffer";

const RequestLoanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedOption, setSelectedOption] = useState<LoanProductOption | undefined>(undefined);

  const steps = [
    { path: "1", title: "Pick an option" },
    { path: "2", title: "Pick an offer" },
  ];

  const currentStepIndex = steps.findIndex(step => location.pathname.endsWith(step.path));

  const goToNext = () => {
    if (currentStepIndex < steps.length - 1) {
      navigate(steps[currentStepIndex + 1].path, { state: { option: selectedOption } });
    }
  };

  const goToPrevious = () => {
    if (currentStepIndex > 0) {
      navigate(steps[currentStepIndex - 1].path, { state: { option: selectedOption } });
    }
  };

  return (
    <Box
      className="flex-1 overflow-y-scroll p-6 md:px-8"
      style={{
        height: window.innerHeight - 130,
      }}
    >
      {/* Heading */}
      <Box className="text-center">
        <Heading size={"7"}>Request Loan</Heading>
        <Text size={"2"} weight={"medium"} className="text-font/45">
          Get your first loan with two easy steps.
        </Text>
      </Box>

      {/* Steps */}
      <Flex my={"7"} align={"center"} justify={"center"}>
        {steps.map((step, index) => (
          <Flex key={index} align={"center"}>
            <Flex
              className={`border rounded-full ${currentStepIndex === index ? "border-purple-800" : ""} ${
                currentStepIndex > index ? "border-font-dark" : "border-font/10"
              } p-2.5`}
              align={"center"}
              gap={"2"}
            >
              <Flex
                align={"center"}
                justify={"center"}
                className={`h-5 w-5 ${currentStepIndex === index ? "border-purple-800 text-purple-800" : ""} ${
                  currentStepIndex > index ? "text-font-dark" : "md:border border-font/10 text-font/50"
                } rounded-full`}
              >
                {currentStepIndex > index
                  ? (
                    <IoIosCheckmarkCircle
                      size={24}
                    />
                  )
                  : (
                    <Text
                      size={"1"}
                      weight={"medium"}
                    >
                      {index + 1}
                    </Text>
                  )}
              </Flex>

              <Text
                size={"2"}
                weight={"medium"}
                className={`hidden
                 ${currentStepIndex === index ? "border-purple-800 text-purple-800" : ""}
                 ${currentStepIndex > index ? "text-font-dark" : "text-font/50"} md:block`}
              >
                {currentStepIndex > index
                  ? (
                    <Link to={step.path}>
                      {step.title}
                    </Link>
                  )
                  : step.title}
              </Text>
            </Flex>
            {steps.length !== index + 1 && (
              <Separator
                className={currentStepIndex === index ? "border-font-dark" : "border-font/50"}
                size={{
                  initial: "2",
                  lg: "3",
                }}
              />
            )}
          </Flex>
        ))}
      </Flex>

      <CardBody>
        <Routes>
          <Route
            index
            path="1"
            element={
              <Step1PickOption
                onSelect={setSelectedOption}
                selectedOption={selectedOption}
              />
            }
          />
          <Route path="2" element={<Step2PickOffer />} />
          <Route path="/" element={<Navigate to="1" />} />
        </Routes>
      </CardBody>

      <CardFooter className="flex justify-between">
        <Button
          onClick={goToPrevious}
          disabled={currentStepIndex === 0}
          variant="outline"
        >
          <FaArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        {currentStepIndex < steps.length - 1
          && (
            <Button
              onClick={goToNext}
              disabled={currentStepIndex === steps.length - 1
                || selectedOption === undefined}
            >
              {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
              <FaArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
      </CardFooter>
    </Box>
  );
};

export default RequestLoanWizard;
