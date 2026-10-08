import subprocess
import json
import unittest

class TestTosClassifier(unittest.TestCase):
    def test_sample_cards_classification(self):
        cards = [
            {
                "id": "card-1",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "A digital communication system transmits at a rate of 9600 bits per second utilizing an 8-PSK modulation scheme. Calculate the exact symbol rate (baud rate) on the transmission link. 3200 baud 9600 baud 2400 baud 1200 baud"
            },
            {
                "id": "card-2",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "Evaluate the stability of a digital system whose transfer function has poles located at z1 = 0.5 + j0.5 and z2 = 0.5 - j0.5. How is this system classified? Stable, because the magnitude of all poles is strictly less than unity Unstable, because the phase angle exceeds 45 degrees"
            },
            {
                "id": "card-3",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "Using Carson's rule, determine the approximate required transmission bandwidth for an FM signal exhibiting a peak frequency deviation of 25 kHz and driven by a maximum modulating frequency of 5 kHz. 30 kHz 50 kHz 60 kHz 100 kHz"
            },
            {
                "id": "card-4",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "An error-correcting block code possesses a minimum Hamming distance of d_min = 7. What is the maximum number of simultaneous bit errors this code can guarantee to correctly fix in a single codeword? 6 errors 7 errors 3 errors 2 errors"
            },
            {
                "id": "card-5",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "What atmospheric condition causes the radio horizon to extend beyond the visual horizon (standard k-factor of 4/3)? Sub-refraction Super-refraction Standard atmospheric refraction Ducting"
            },
            {
                "id": "card-6",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "A noiseless channel has a bandwidth of 3 kHz. If an 8-level signaling scheme is used, what is the maximum theoretical data rate according to the Nyquist capacity formula? 24 kbps 6 kbps 18 kbps 9 kbps"
            },
            {
                "id": "card-7",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "If a signal is defined as being conjugate symmetric, how does its real part relate to the time axis? The real part is zero for all negative time The real part is purely imaginary The real part is an even function of time The real part is an odd function of time"
            },
            {
                "id": "card-8",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "When analyzing local area networks, how does the CSMA/CD protocol explicitly handle the detection of a data collision? The network interface temporarily suspends transmission and waits for the channel to become idle before resending the affected frame The receiving station transmits a negative acknowledgment requesting that the sender immediately retransmit the corrupted frame The transmitting nodes increase their signal power and continue sending until the interfering transmission is no longer detected The transmitting nodes immediately stop, transmit a jam signal, and wait a random backoff period before attempting retransmission"
            },
            {
                "id": "card-9",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "A completely interconnected physical mesh network must be deployed to link 8 highly secure data centers. Calculate the number of dedicated physical cables required. 28 8 16 64"
            },
            {
                "id": "card-10",
                "subject": "EST",
                "deckName": "Pre-Board Exam EST",
                "text": "A basic pulsed RADAR system transmits a pulse and receives the target echo exactly 10 microseconds later. Calculate the distance to the target. 30 km 3 km 1.5 km 15 km"
            }
        ]
        res = subprocess.run(
            ["python3", "scripts/classify_database_tos.py", "--stdin"],
            input=json.dumps(cards),
            text=True,
            capture_output=True,
            check=True
        )
        data = json.loads(res.stdout)
        mapping = {item["id"]: item["tosTopicId"] for item in data}
        self.assertEqual(mapping["card-1"], "EST-3.4")
        self.assertEqual(mapping["card-2"], "EST-1.5")
        self.assertEqual(mapping["card-3"], "EST-3.5")
        self.assertEqual(mapping["card-4"], "EST-3.5")
        self.assertEqual(mapping["card-5"], "EST-4.4")
        self.assertEqual(mapping["card-6"], "EST-3.5")
        self.assertEqual(mapping["card-7"], "EST-1.1")
        self.assertEqual(mapping["card-8"], "EST-6.1")
        self.assertEqual(mapping["card-9"], "EST-6.2")
        self.assertEqual(mapping["card-10"], "EST-2.8")

    def test_additional_patterns(self):
        cards = [
            {
                "id": "card-geas-crystal",
                "subject": "GEAS",
                "deckName": "Review Exam GEAS",
                "text": "What type of crystal structure has an atomic packing factor of 0.68 and coordination number of 8? Body-centered cubic Face-centered cubic"
            },
            {
                "id": "card-geas-mgmt",
                "subject": "GEAS",
                "deckName": "Review Exam GEAS",
                "text": "The controlling function and organizing function in a company ensure that performance matches plans. Planning Leading Organizing Controlling"
            },
            {
                "id": "card-math-em",
                "subject": "MATH",
                "deckName": "Review Exam Math",
                "text": "Point charges in free space produce an electric (E-) field measured in coulombs. Calculate the electric charge density."
            }
        ]
        res = subprocess.run(
            ["python3", "scripts/classify_database_tos.py", "--stdin"],
            input=json.dumps(cards),
            text=True,
            capture_output=True,
            check=True
        )
        data = json.loads(res.stdout)
        mapping = {item["id"]: item["tosTopicId"] for item in data}
        self.assertEqual(mapping["card-geas-crystal"], "GEAS-7.2")
        self.assertEqual(mapping["card-geas-mgmt"], "GEAS-4.3")
        self.assertEqual(mapping["card-math-em"], "MATH-6.1")

    def test_deck_default_tos_bias(self):
        cards = [
            {
                "id": "card-micro-pwm",
                "subject": "ELECS",
                "deckName": "MICROPS Top",
                "defaultTosTopicId": "ELECS-8.1",
                "text": "A microcontroller component that allows it to output an analog signal through some of its digital pins? PWM ADC DAC Timer"
            },
            {
                "id": "card-micro-default",
                "subject": "ELECS",
                "deckName": "MICROPS Top",
                "defaultTosTopicId": "ELECS-8.1",
                "text": "Which of the following is an instruction to clear the accumulator? CLA NOP HLT RET"
            }
        ]
        res = subprocess.run(
            ["python3", "scripts/classify_database_tos.py", "--stdin"],
            input=json.dumps(cards),
            text=True,
            capture_output=True,
            check=True
        )
        data = json.loads(res.stdout)
        mapping = {item["id"]: item["tosTopicId"] for item in data}
        # Microcontroller question with PWM/ADC distractors should stay in topic 8 (8.5), not 6.3
        self.assertEqual(mapping["card-micro-pwm"], "ELECS-8.5")
        # Card with general microprocessor content should receive deck default 8.1
        self.assertEqual(mapping["card-micro-default"], "ELECS-8.1")

if __name__ == "__main__":
    unittest.main()
