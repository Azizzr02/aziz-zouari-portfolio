const BenchFiles = (() => {
  const profiles = {
    linkedin: {label:"LinkedIn", href:"https://www.linkedin.com/in/aziz-zouari"},
    github: {label:"GitHub", href:"https://github.com/Azizzr02"},
    resume: {label:"Print-friendly résumé", href:"resume.html"},
    email: {label:"Email Aziz", href:"mailto:Aziz.zouari@eniso.u-sousse.tn"},
    lab: {label:"Play Signal Lab", href:"signal-lab.html"},
  };
  const firmware = {label:"BMS STM32 firmware", href:"https://github.com/Azizzr02/BMS_STM32_Firmware"};
  const dashboard = {label:"Raspberry Pi dashboard", href:"https://github.com/Azizzr02/RPI-dashboard"};
  const adas = {label:"ADAS project repository", href:"https://github.com/Azizzr02/Adas-Project"};
  const files = {
    "README.md": {
      title:"Aziz Zouari",
      subtitle:"Embedded software engineer · Sousse, Tunisia",
      intro:"I work on embedded firmware and the systems that make it testable: STM32 peripherals, Linux gateways, and instrumentation that shows where a signal goes wrong.",
      sections:[
        ["About","Read about/profile.md for my engineering focus and about/education.md for my training and activities."],
        ["Experience","Explore three internships spanning a CAN-FD battery management test bench, a Zigbee sensor network, and Raspberry Pi monitoring."],
        ["Projects","Open a project file to see the design goal, how the system fits together, and supporting source or documentation."],
      ],
      links:[profiles.resume,profiles.linkedin,profiles.github],
    },
    "about/profile.md": {
      title:"About Aziz",
      subtitle:"Industrial electronics · Embedded software · System validation",
      intro:"I’m an embedded software engineer based in Sousse, Tunisia, with a background in industrial electronics. I’m interested in the point where software meets signals, sensors, and hardware.",
      sections:[
        ["What I build","I write Embedded C and C++ for microcontrollers and use Python, Linux, and shell tooling to integrate and validate the wider system. My portfolio includes STM32 firmware, CAN-FD supervision with SocketCAN, and a vision-to-control prototype with a Yocto Linux gateway."],
        ["How I debug","I follow a failure across boundaries: verify the supply, check timing on the wire, compare the decoded data with what the firmware reports, then isolate the fault. The instruments in the 3D bench let you try a simplified version of that workflow."],
        ["Languages","Arabic (native), English B2 (TOEIC), French B2 (DELF), and German B1."],
      ],
      links:[profiles.resume,profiles.linkedin],
    },
    "about/education.md": {
      title:"Education and activities",
      subtitle:"2021–2026 · Tunisia",
      sections:[
        ["National Engineering School of Sousse (ENISo)","National Engineering Diploma in Industrial Electronics, September 2023 to June 2026. Graduated with Highest Honors. My final-year project was a CAN-FD test bench for a battery management system at SEGULA Technologies."],
        ["Preparatory Institute for Engineering Studies of Monastir (IPEIM)","Preparatory cycle in physics and technology, September 2021 to June 2023."],
        ["Junior Entreprise ENISo","Led a team of eight and mentored junior members from October 2024 to May 2025."],
        ["NXP Cup Tunisia","Our C++ robotics project placed third in Tunisia in April 2025."],
        ["FPGA coursework","Studied FPGA architecture and implemented VHDL projects on Xilinx boards using Vivado and ModelSim."],
      ],
      links:[profiles.resume],
    },
    "experience/segula-technologies.md": {
      title:"SEGULA Technologies",
      subtitle:"Embedded Software Engineer Intern · February–June 2026",
      intro:"My final-year project was a bench for exercising battery-management telemetry and checking how an embedded node responds to faults.",
      sections:[
        ["Firmware on STM32G0B1RE","I developed features for a BMS-style temperature node. The firmware samples analog inputs, filters readings, updates health states, publishes CAN-FD telemetry at 10 Hz, and exposes status over UART."],
        ["Linux supervision","A Raspberry Pi receives frames through SocketCAN and decodes the telemetry with a DBC file. The supervisor can send test commands back to the node. A Python FastAPI service shares updates with the dashboard over WebSocket."],
        ["Validation","I exercised nominal telemetry, fault injection and reset behavior on the bench. One test run received 600 frames without loss. The firmware and supervisor repositories show both sides of that test path."],
      ],
      links:[firmware,dashboard,{label:"CAN-FD project summary",href:"projects.html#bms"}],
    },
    "experience/yuccainfo.md": {
      title:"YUCCAINFO",
      subtitle:"IoT and Embedded Systems Intern · June–August 2025",
      intro:"I worked on a sensor network that brings readings from STM32 devices to a dashboard for real-time monitoring.",
      sections:[
        ["Sensor node","I deployed a Zigbee stack on STM32WB55 and integrated peripheral drivers using UART, I²C, and SPI. The node packaged sensor readings for delivery to a Raspberry Pi coordinator."],
        ["Gateway and dashboard","I integrated a Zigbee-to-MQTT bridge and used Node-RED to visualize readings. I tested the path from the driver and radio through the coordinator and MQTT broker."],
        ["Result","Sensor data collection reached 99.8% reliability in the internship test setup."],
      ],
      links:[{label:"Résumé and experience",href:"resume.html"}],
    },
    "experience/sindibad-group.md": {
      title:"SINDIBAD-GROUP",
      subtitle:"Embedded Systems Intern · June–August 2024",
      intro:"I worked on automating sensor collection on a Raspberry Pi and publishing the readings to an IoT platform.",
      sections:[
        ["Integration","The Pi collected readings over I²C and UART and forwarded them for centralized monitoring. I checked the workflow from data acquisition to the platform."],
        ["Testing","I refactored the data collection code for performance and memory use. The updated workflow improved testing efficiency by 40% during the internship."],
      ],
      links:[{label:"Résumé and experience",href:"resume.html"}],
    },
    "projects/can-fd-test-bench.md": {
      title:"CAN-FD battery management test bench",
      subtitle:"Final-year project · SEGULA Technologies · 2026",
      intro:"The goal was to generate realistic battery-management telemetry on a controllable bench so that the node and the supervisor could be tested together.",
      diagram:"ADC inputs  →  STM32G0B1RE  ⇄  CAN-FD  ⇄  Raspberry Pi / SocketCAN\n                                                   ↓\n                                              Web dashboard",
      sections:[
        ["Node and bus","The STM32 filters ADC readings and updates the emulated temperature and health state. The firmware publishes at 10 Hz over CAN-FD and reports status on UART. The bench accepts commands for testing fault and reset paths."],
        ["Supervisor","On Linux, SocketCAN exposes the frames to the Python application. The DBC describes their meaning, and FastAPI delivers updates over WebSocket to the browser dashboard."],
        ["Evidence","A 600-frame run completed without loss. The two repositories document the firmware, CAN message definitions, and the Raspberry Pi supervision code."],
      ],
      links:[firmware,dashboard],
    },
    "projects/vision-to-control.md": {
      title:"Vision-to-control ADAS prototype",
      subtitle:"Collaborative embedded systems project · Aziz and Oussema",
      intro:"We built a prototype that passes measurements from a camera-based perception system to an STM32 motor controller through a Linux CAN gateway.",
      diagram:"Camera / YOLOP on laptop  →  UDP  →  Raspberry Pi / Yocto\n                                              ↓ CAN\n                                    STM32F407 / 50 Hz PWM",
      sections:[
        ["Perception","YOLOP runs on the laptop and estimates lane offset and distance from camera input. Those measurements go to the gateway over UDP."],
        ["Linux gateway","A Raspberry Pi 4 runs a custom Yocto image. The Python gateway converts the incoming UDP data into CAN messages using SocketCAN."],
        ["Motor control","The STM32F407 translates the received data into a 50 Hz PWM path for motor control. The separation made it possible to test perception, transport, and actuation independently."],
      ],
      links:[adas,{label:"Project demo on LinkedIn",href:"https://www.linkedin.com/posts/aziz-zouari_adas-autonomousvehicles-embeddedsystems-activity-7408880455871049728-kYnw"}],
    },
    "projects/thermal-ecu.md": {
      title:"Dual-STM32 thermal monitoring ECU",
      subtitle:"PCB design and bring-up · May 2025",
      intro:"I designed a board-level prototype that reads a temperature sensor, reports thermal alerts over CAN, and controls a cooling fan with PWM.",
      diagram:"Sensor / ADC  →  STM32  ⇄  CAN  ⇄  STM32\n                    ↓\n              PWM cooling fan",
      sections:[
        ["Hardware","I designed the schematics and PCB layout in Altium Designer and assembled the board before bring-up."],
        ["Firmware and signals","The application acquires temperature through ADC, uses CAN to share alerts across the two STM32 nodes, and changes the fan duty cycle in response to the readings."],
        ["Bench checks","I used an oscilloscope, logic analyzer, and multimeter to check the power, measurement, communication, and PWM paths while validating the prototype."],
      ],
      links:[{label:"Thermal ECU project summary",href:"projects.html#thermal"}],
    },
    "projects/bare-metal-stm32.md": {
      title:"Bare-metal STM32 drivers",
      subtitle:"Personal firmware project · November 2024",
      intro:"I worked at register level on UART, I²C, and CAN to exercise interrupt handling, data buffering, and peripheral timing.",
      sections:[
        ["Development","I configured the peripherals directly and used interrupts and ring buffers to handle incoming data. I checked interface timing as part of validation."],
        ["Related source","The two-board STM32 UART project demonstrates interrupt-driven communication and ADC acquisition across a concrete hardware link."],
      ],
      links:[{label:"Two-board STM32 UART repository",href:"https://github.com/Azizzr02/Dual-Card-Data-Transmission-System-STM32-UART-"}],
    },
    "skills/firmware.md": {
      title:"Firmware and interfaces",
      subtitle:"Embedded C/C++ · STM32 · Bare metal and RTOS",
      sections:[
        ["Microcontrollers","STM32 development with ADC, timers, interrupts, and PWM. Experience with register-level peripherals, ring buffers, and FreeRTOS."],
        ["Communication","CAN and CAN-FD for system telemetry. UART, SPI, and I²C for peripherals and debugging. Zigbee and MQTT for embedded sensor integration."],
        ["Independent learning","I use a Zephyr course repository to explore that RTOS. My FPGA work includes VHDL coursework on Xilinx tooling."],
      ],
      links:[{label:"Zephyr learning repo",href:"https://github.com/Azizzr02/zephyr-course"},profiles.github],
    },
    "skills/linux-and-validation.md": {
      title:"Linux and hardware validation",
      subtitle:"Raspberry Pi · Yocto · SocketCAN · Python",
      sections:[
        ["Linux integration","Custom Yocto image and CAN gateway on Raspberry Pi for the vision prototype. SocketCAN, DBC decoding, FastAPI and WebSocket updates for the test bench."],
        ["Bench instrumentation","I use a multimeter for supply and continuity checks, a logic analyzer for digital timing, and a scope for waveforms and PWM. My thermal ECU work also included schematic capture, PCB layout, assembly, and bring-up."],
        ["Test tooling","I use Python and shell scripts to automate test execution, record data, and make the conditions behind a result repeatable."],
      ],
      links:[dashboard,adas],
    },
    "contact/links.md": {
      title:"Contact and profiles",
      subtitle:"Aziz Zouari",
      intro:"Use the links below to get in touch, view source code, or open my full résumé. From the shell, try open linkedin, open github, or open resume.",
      links:[profiles.linkedin,profiles.github,profiles.email,profiles.resume,profiles.lab],
    },
    "contact/linkedin.url": {
      title:"LinkedIn",
      intro:"Open my LinkedIn profile for my professional activity and updates.",
      links:[profiles.linkedin],
      destination:profiles.linkedin,
    },
  };
  return {files,profiles};
})();
