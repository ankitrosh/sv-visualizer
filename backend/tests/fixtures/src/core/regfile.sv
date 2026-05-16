module regfile #(
    parameter NUM_REGS = 16
) (
    input  logic clk,
    input  logic rst_n,
    input  logic [4:0] addr,
    output logic [31:0] data
);
    logic [31:0] regs [0:NUM_REGS-1];
    assign data = regs[addr];
endmodule
