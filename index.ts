import { Fish, FishId, Pond, Tags } from '@actyx/pond'

const DEBUG = !!process.env.DEBUG

interface MachineState {
    bufferQty: number
}

interface MachineBufferChanged {
    qty: number
}

interface RobotState {
    inputBufferQty: number
    outputBufferQty: number
}

interface RobotBufferChanged {
    buffer: 'input' | 'output'
    qty: number
}

function emitRobotInputBufferChanged(pond: Pond, qty: number) {
    const event: RobotBufferChanged = {
        buffer: 'input',
        qty
    }
    pond.emit(Tags('robot'), event)
}

function emitRobotOutputBufferChanged(pond: Pond, qty: number) {
    const event: RobotBufferChanged = {
        buffer: 'output',
        qty
    }
    pond.emit(Tags('robot'), event)
}

function emitMachineBufferChanged(pond: Pond, qty: number) {
    const event: MachineBufferChanged = {
        qty
    }
    pond.emit(Tags('machine'), event)
}


const MachineFish: Fish<MachineState, MachineBufferChanged> = {
    fishId: FishId.of('machine', 'machine', 0),
    where: Tags('machine'),
    initialState: { bufferQty: 0 },
    onEvent: function (state, event) {
        const newState: MachineState = {
            ...state,
            bufferQty: state.bufferQty + event.qty
        }

        if (DEBUG) {
            console.log(`machine state transitioned with event`, event)
            console.log(`was:`, state)
            console.log(`now:`, newState)
        }
        return newState
    }
}

const RobotFish: Fish<RobotState, RobotBufferChanged> = {
    fishId: FishId.of('robot', 'robot', 0),
    where: Tags('robot'),
    initialState: { inputBufferQty: 0, outputBufferQty: 0 },
    onEvent: function (state, event) {
        let newState: RobotState = state;
        if (event.buffer === 'input') {
            newState = {
                ...state,
                inputBufferQty: state.inputBufferQty + event.qty
            }
        } else if (event.buffer === 'output') {
            newState = {
                ...state,
                outputBufferQty: state.outputBufferQty + event.qty
            }
        }
        if (DEBUG) {
            console.log(`robot state transitioned with event`, event)
            console.log(`was:`, state)
            console.log(`now:`, newState)
        }
        return newState
    }
}

async function runRobot(pond: Pond) {

    let machineState: MachineState | undefined = undefined
    let robotState: RobotState | undefined = undefined

    let currentlyPickingUp = false
    let currentlyPackaging = false

    function showState() {
        if (!DEBUG) { console.clear() }
        if (currentlyPackaging) {
            console.log(`Robot: 🟢 PACKAGING`)
        } else if (currentlyPickingUp) {
            console.log(`Robot: 🟠 PICKING UP`)
        } else {
            console.log(`Robot: ⚪️ IDLE`)
        }
    }

    pond.observe(MachineFish, state => {
        machineState = state
        onChange()
    })

    pond.observe(RobotFish, state => {
        robotState = state
        onChange()
    })

    function onChange() {
        showState()
        if (!machineState || !robotState || currentlyPickingUp || currentlyPackaging) {
            return
        }

        if (machineState.bufferQty > 0 && robotState.inputBufferQty + 1 < 9) {
            currentlyPickingUp = true
            showState()
            setTimeout(() => {
                emitMachineBufferChanged(pond, -1)
                emitRobotInputBufferChanged(pond, 1)
                currentlyPickingUp = false
            }, 2000)
            return
        }

        if (robotState.inputBufferQty > 0 && robotState.outputBufferQty + 1 < 9) {
            currentlyPackaging = true
            showState()
            setTimeout(() => {
                emitRobotInputBufferChanged(pond, -1)
                emitRobotOutputBufferChanged(pond, 1)
                currentlyPackaging = false
            }, 3000)
            return
        }
    }
}

async function runMachine(pond: Pond) {

    let currentlyProducing = false

    function showState() {
        if (!DEBUG) { console.clear() }
        if (currentlyProducing) {
            console.log(`Machine: 🟢 PRODUCING`)
        } else {
            console.log(`Machine: ⚪️ IDLE`)
        }

    }

    pond.observe(MachineFish, state => {
        showState()
        if (!currentlyProducing && state.bufferQty < 5) {
            currentlyProducing = true
            showState()
            setTimeout(() => {
                emitMachineBufferChanged(pond, 1)
                currentlyProducing = false
            }, 4000)
        }
    })
}

async function runForklift(pond: Pond) {

    let currentlyDroppingOff = false
    function showState() {
        console.clear()
        if (currentlyDroppingOff) {
            console.log(`Forklift: 🟢 DROPPING OFF`)
        } else {
            console.log(`Forklift: ⚪️ IDLE`)
        }
    }

    pond.observe(RobotFish, state => {
        showState()
        if (!currentlyDroppingOff && state.outputBufferQty > 0) {
            currentlyDroppingOff = true
            emitRobotOutputBufferChanged(pond, -1 * state.outputBufferQty)
            showState()
            setTimeout(() => {
                currentlyDroppingOff = false
                showState()
            }, 10000)
        }
    })

}

async function runDashboard(pond: Pond) {

    let machineState: MachineState | undefined = undefined
    let robotState: RobotState | undefined = undefined

    function showDashboard() {
        if (!machineState || !robotState) {
            return
        }
        console.clear()
        console.log('MACHINE')
        console.log(`| buffer: ${machineState.bufferQty} ${[...Array(machineState.bufferQty)].map(() => '🥽').join('')}`)
        console.log('ROBOT')
        console.log(`| input:  ${robotState.inputBufferQty} ${[...Array(robotState.inputBufferQty)].map(() => '🥽').join('')}`)
        console.log(`| output: ${robotState.outputBufferQty} ${[...Array(robotState.outputBufferQty)].map(() => '📦').join('')}`)
    }

    pond.observe(MachineFish, state => {
        machineState = state
        showDashboard()
    })
    pond.observe(RobotFish, state => {
        robotState = state
        showDashboard()
    })

}

(async () => {

    const pond = await Pond.default({
        appId: 'com.example.app',
        version: '1.0.0',
        displayName: 'Example App'
    })

    switch (process.argv[2]) {
        case 'robot': {
            return await runRobot(pond)
        }
        case 'forklift': {
            return await runForklift(pond)
        }
        case 'machine': {
            return await runMachine(pond)
        }
        case 'dashboard': {
            return await runDashboard(pond)
        }
    }
})()